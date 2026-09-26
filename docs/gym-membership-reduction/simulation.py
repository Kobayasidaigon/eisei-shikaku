# -*- coding: utf-8 -*-
"""
ジム会員数の適正化シミュレーション(report.md の数値の再計算用)

使い方:  python3 simulation.py
  - 標準ライブラリだけで動きます。
  - 数値はすべてモデルケースの仮定(推測)です。自分のジムの実数に置き換えて使ってください。
  - 置き換える場所は「1. 前提」のブロックだけです。

モデルの考え方(report.md 付録A と同じ):
  - 会員を利用タイプ A/B/C/S/D に分け、月ごとに「イベント → 退会 → 入会」の順で人数を動かす。
  - ピーク需要 = K × Σ(ピーク帯に入れるプランの人数 × 月間来館回数 × ピーク帯の来館比率) × 非価格施策の係数
    K は「現状のピーク需要 = 55人」になるように逆算する。
  - オフピークプランの会員は平日18〜22時に入館できないので、ピーク需要に数えない。
"""
import math

# ---------------------------------------------------------------- 1. 前提
TYPES = "ABCSD"
# A: ピーク固定層 / B: 時間を動かせる層 / C: オフピーク中心層 / S: 低頻度層 / D: 休眠層
INIT = dict(A=330, B=206, C=289, S=300, D=375)          # 在籍 1,500人の内訳(推測)
VISITS = dict(A=8, B=8, C=8, S=0.5, D=0)                # 月間来館回数(推測)
PEAK_SHARE = dict(A=0.85, B=0.35, C=0.05, S=0.40, D=0)  # 平日19〜22時に来る割合(推測)
CHURN = dict(A=0.025, B=0.025, C=0.025, S=0.045, D=0.05)  # 月の退会率(加重平均 3.525%)
PEAK_NOW = 55.0            # 現状のピーク同時利用(人)
CAPACITY = 35              # 快適な上限(人)
NEW_PER_MONTH = 60         # 現状の新規入会(人/月)
P_OLD = 7980               # 現行月会費(税込)
P_NEW_REG = 9980           # 新規レギュラーの月会費(2か月目〜)
ENTRY_FEE = 11000          # 新規レギュラーの入会金(2か月目〜)
ENTRY_FEE_DETER = 0.20     # 入会金で新規レギュラーが減る割合(推測)
P_OFFPEAK = 7480           # オフピークプラン(平日18〜22時は入館不可)
P_HOLD = 1650              # 休会プラン
P_REVISED = 8980           # 既存レギュラーの改定後料金(8か月目〜)
ELASTICITY_NEW = -1.0      # 新規の価格弾力性(推測)
ELASTICITY_EXIST = -0.6    # 既存会員の価格弾力性(推測)。タイプ別倍率を掛ける
ELASTICITY_MULT = dict(A=0.6, B=0.8, C=0.8, S=1.5, D=2.0)
EXIT_TO_HOLD = 0.30        # 値上げで離れる人のうち休会を選ぶ割合(推測)
SWITCH_GAP500 = dict(A=0.02, B=0.22, C=0.33, S=0.18, D=0.10)      # 差額500円での切替率(推測)
SWITCH_GAP1500 = dict(A=0.035, B=0.35, C=0.50, S=0.275, D=0.175)  # 差額1,500円での切替率(推測)
NEW_OFFPEAK_SHARE = dict(A=0.0, B=0.7, C=0.9, S=0.65, D=0.65)     # 新規がオフピークを選ぶ割合(推測)
RETURN_90DAY = dict(A=0.30, B=0.15, C=0.05, S=0.05, D=0.05)       # 90日保証で元に戻す割合(推測)
NONPRICE_FACTOR = 0.9216   # 見える化・利用ルールによるピーク需要の係数(4か月目〜。3か月目は効果の1/4)
ONLINE_CANCEL_ADD = 0.006  # 退会のオンライン化で S/D の退会率が上がる幅(推測)
HOLD_CHURN = 0.05          # 休会会員の月の退会率(推測)
D_TO_HOLD = 0.05           # 休眠層のうち休会プランを選ぶ割合(8か月目、推測)
CAP_CHURN_REF = 22         # 予約上限で押し出される割合16%のとき、3か月で追加退会する人数(推測)

# ---------------------------------------------------------------- 2. モデル
def simulate(new_pricing=True, switch=True, nonprice=True, online_cancel=True,
             price_revision=True, cap=True, cap_start=10, months=12,
             elasticity_exist=ELASTICITY_EXIST, switch_mult=1.0, nonprice_factor=NONPRICE_FACTOR):
    K = PEAK_NOW / sum(INIT[t] * VISITS[t] * PEAK_SHARE[t] for t in TYPES)
    out0 = sum(INIT[t] * CHURN[t] for t in TYPES)
    mix = {t: INIT[t] * CHURN[t] / out0 for t in TYPES}  # 新規のタイプ構成 = 退会者の構成(定常の仮定)
    reg_old = {t: float(INIT[t]) for t in TYPES}  # 既存料金のレギュラー
    reg_new = {t: 0.0 for t in TYPES}             # 新規料金のレギュラー
    off = {t: 0.0 for t in TYPES}                 # オフピーク
    hold = {t: 0.0 for t in TYPES}                # 休会
    price_old = P_OLD
    moved, rows = {}, []
    prev_reg_out, prev_peak, cap_extra = out0, PEAK_NOW, 0.0
    for m in range(1, months + 1):
        # --- イベント
        if switch and m == 3:
            for t in TYPES:
                x = reg_old[t] * SWITCH_GAP500[t] * switch_mult
                reg_old[t] -= x; off[t] += x; moved[t] = x
        if switch and m == 5:  # 90日お試し保証で元のプランに戻る人
            for t in TYPES:
                x = min(off[t], moved[t] * RETURN_90DAY[t] * (1 - CHURN[t]) ** 2)
                off[t] -= x; reg_old[t] += x
        if price_revision and m == 8:
            price_old = P_REVISED
            for t in TYPES:
                keep = (P_REVISED / P_OLD) ** (elasticity_exist * ELASTICITY_MULT[t])
                ex = reg_old[t] * (1 - keep)
                reg_old[t] -= ex; hold[t] += ex * EXIT_TO_HOLD
                if switch:
                    a = SWITCH_GAP500[t] * switch_mult
                    x = reg_old[t] * (SWITCH_GAP1500[t] - SWITCH_GAP500[t]) * switch_mult / (1 - a)
                    reg_old[t] -= x; off[t] += x
        if online_cancel and m == 8:
            x = reg_old["D"] * D_TO_HOLD; reg_old["D"] -= x; hold["D"] += x
        f = 1.0
        if nonprice and m >= 3:
            f = 1 - (1 - nonprice_factor) / 4 if m == 3 else nonprice_factor

        def peak_demand():
            return K * f * sum((reg_old[t] + reg_new[t]) * VISITS[t] * PEAK_SHARE[t] for t in TYPES)

        # --- 退会
        reg_out = 0.0
        for t in TYPES:
            c = CHURN[t] + (ONLINE_CANCEL_ADD if online_cancel and m >= 3 and t in "SD" else 0)
            for pool in (reg_old, reg_new, off):
                o = pool[t] * c; pool[t] -= o
                if pool is not off:
                    reg_out += o
            hold[t] -= hold[t] * HOLD_CHURN
        cap_out = 0.0
        if cap and cap_start <= m <= cap_start + 2:  # 予約が取りにくくなった人の追加退会(3か月に分散)
            dem = peak_demand(); disp = max(0.0, (dem - CAPACITY) / dem)
            if m == cap_start:
                cap_extra = CAP_CHURN_REF * min(1.5, disp / 0.16)
            load = {(t, i): p[t] * VISITS[t] * PEAK_SHARE[t] for t in "AB" for i, p in enumerate((reg_old, reg_new))}
            total = sum(load.values())
            for (t, i), l in load.items():
                pool = (reg_old, reg_new)[i]
                x = min(pool[t], cap_extra / 3 * l / total); pool[t] -= x; cap_out += x
            reg_out += cap_out
        # --- 入会
        if new_pricing and m >= 2:
            in_reg = {t: NEW_PER_MONTH * mix[t] * (1 - NEW_OFFPEAK_SHARE[t]) * (P_NEW_REG / P_OLD) ** ELASTICITY_NEW
                      * (1 - ENTRY_FEE_DETER) for t in TYPES}
            in_off = {t: NEW_PER_MONTH * mix[t] * NEW_OFFPEAK_SHARE[t] * (P_OFFPEAK / P_OLD) ** ELASTICITY_NEW for t in TYPES}
            n_reg = sum(in_reg.values())
            slots = max(0.0, prev_reg_out - max(0.0, prev_peak - CAPACITY))  # レギュラーの受付枠
            waiting = 0.0
            if n_reg > slots:  # 枠を超えた分はウェイティングリストへ(3割はオフピークで入会、と仮定)
                r = slots / n_reg; waiting = n_reg - slots
                for t in TYPES:
                    in_off[t] += in_reg[t] * (1 - r) * 0.3; in_reg[t] *= r
                n_reg = slots
            target = reg_new
        else:
            in_reg = {t: NEW_PER_MONTH * mix[t] for t in TYPES}; in_off = {t: 0.0 for t in TYPES}
            n_reg, waiting, target = NEW_PER_MONTH, 0.0, reg_old
        for t in TYPES:
            target[t] += in_reg[t]; off[t] += in_off[t]
        dem = peak_demand()
        measured = min(dem, CAPACITY) if (cap and m >= cap_start) else dem
        s_old, s_new, s_off, s_hold = (sum(p.values()) for p in (reg_old, reg_new, off, hold))
        fees = s_old * price_old + s_new * P_NEW_REG + s_off * P_OFFPEAK + s_hold * P_HOLD
        entry = ENTRY_FEE * n_reg if (new_pricing and m >= 2) else 0.0
        rows.append(dict(m=m, total=s_old + s_new + s_off + s_hold, reg_old=s_old, reg_new=s_new, off=s_off,
                         hold=s_hold, demand=dem, measured=measured, fees=fees, entry=entry,
                         new_reg=n_reg, new_off=sum(in_off.values()), cap_out=cap_out, waiting=waiting))
        prev_reg_out, prev_peak = reg_out, dem
    return rows


def round_parts(values):
    """内訳の合計が総数の四捨五入と一致するように丸める(最大剰余法)。"""
    floors = [math.floor(v) for v in values]
    rest = round(sum(values)) - sum(floors)
    for i in sorted(range(len(values)), key=lambda i: floors[i] - values[i])[:rest]:
        floors[i] += 1
    return floors


def show(name, rows, detail=False):
    base = sum(INIT.values()) * P_OLD
    if detail:
        print(f"== {name}")
        print(" 月  在籍  既存R  新規R オフピーク 休会  需要ピーク 実測ピーク  月会費(万円) 現状比  入会金(万円)")
        for r in rows:
            a = round_parts([r['reg_old'], r['reg_new'], r['off'], r['hold']])
            print(f"{r['m']:3d} {sum(a):6d} {a[0]:6d} {a[1]:5d} {a[2]:7d} {a[3]:5d}"
                  f"  {r['demand']:8.1f} {r['measured']:8.1f}  {r['fees'] / 1e4:10.1f}  {r['fees'] / base - 1:+6.1%}  {r['entry'] / 1e4:8.1f}")
    last = rows[-1]
    print(f"{name:34s} 12か月後 在籍={last['total']:5.0f} 需要ピーク={last['demand']:4.1f} 実測={last['measured']:4.1f} "
          f"月会費 {last['fees'] / base - 1:+.1%} 最低月 {min(r['fees'] for r in rows) / base - 1:+.1%}")


if __name__ == "__main__":
    show("推奨(段階的に上限)", simulate(), detail=True)
    print()
    show("何もしない", simulate(False, False, False, False, False, False))
    show("既存の値上げなし", simulate(price_revision=False))
    show("予約上限なし", simulate(cap=False))
    show("値上げ離反が大きい(-1.2)", simulate(elasticity_exist=-1.2))
    show("オフピーク切替が半分", simulate(switch_mult=0.5))
    show("見える化の効果なし", simulate(nonprice_factor=1.0))
    show("最悪寄り(上の3つが同時)", simulate(elasticity_exist=-1.2, switch_mult=0.5, nonprice_factor=1.0))
    show("最悪寄り・値上げ見送り", simulate(price_revision=False, switch_mult=0.5, nonprice_factor=1.0))
