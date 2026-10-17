# PHASE 5 PROTOCOL CONTRACT — Neora World V2
Single source of truth for message types, payloads, profile fields and rules. Server, client scaffolds, tests and the
UX/UI handoff MUST match this file. Pure math lives in `shared/casino_rules.js` (done) and `shared/phase5_rules.js`.

Conventions
- RPG-style actions go through `onAction` and reply `{ type:'action_result', action, reqId, ok, ...result }` (existing pattern), then `pushProfile`.
- Errors: `{ ok:false, error:'<snake_code>' }`. UTC day key = `new Date(now).toISOString().slice(0,10)`.
- All new profile fields are created lazily by `ensurePhase5(p)` in `server/daily_service.js` (idempotent migration).

---------------------------------------------------------------------------------------------------------------------
## 0. New profile fields (`ensurePhase5(p)`)
```
p.worship_day: 'YYYY-MM-DD'|null        p.worship_count: 0      (times this player was worshipped as a champion)
p.mono_stats.goldWon: 0                 (table_service payout adds podium gold)
p.arcade_best: 0                        (placeholder until Phase 6 minigames)
p.mailbox: [ Mail ]                     (max 50, newest first)
p.owl_sent: { day, count }
p.vip: { call_until: 0, communicator: false, black: false, telelinks: [userId] }
p.passport: { day, progress:{ play:0, harvest:0, pet:0 }, claimed:{ play:false, harvest:false, pet:false, bonus:false }, stamps:0 }
p.login_day: 'YYYY-MM-DD'|null          p.couple_streak (existing)   p.couple_streak_day: 'YYYY-MM-DD'|null
p.founder_claimed: false                p.titles: [string]  (p.title existing = equipped title)
p.casino_daily: { day, chests:0, net:0, hands:0 }
p.call_stats: { day, chunks:0 }
```
Mail = `{ id, from, fromName, sentAt, kind:'gift'|'system', note, ribbon, items:[MailItem], claimed:false }`
MailItem = `{ kind:'gear', itemId, refine, dupe:boolean } | { kind:'decor', decId, count } | { kind:'bag', key, count } | { kind:'berries', amount } | { kind:'diamonds', amount }`

---------------------------------------------------------------------------------------------------------------------
## 5A. Grand Starlight Casino (Table Hub mode `casino`)
`MODES.casino = { available:true, minSeats:1 }`. Table option `casinoGame:'pokdeng'|'roulette'` (default `pokdeng`),
set via `table_create {mode:'casino', options:{casinoGame}}` or `table_set_option {casinoGame}` (host, lobby).
`TableManager` gets an injected adapter: `new TableManager({ ..., games: { casino: casinoAdapter } })`.
For `t.mode !== 'monopoly'`: `start()` → `games[mode].start(t)`, `tick()` → `games[mode].tick(t, now)`,
`handle()` routes `casino_*` → `games[mode].handle(t, userId, m)`, leave/disconnect → `games[mode].leave(t, userId)`.
Monopoly code paths are unchanged. Casino tables keep running hands while ≥1 human is seated; humans may join an
empty seat mid-session (they enter at the next betting phase). Bots bet small random chips.

Client → server
```
casino_bet        { tableId, amount }                 Pok-Deng, betting phase. Replaces previous bet (refund + re-escrow).
casino_cheer      { tableId }                         Pok-Deng, betting phase. Toggles 🥂 Cheer (cost cheerCost(bet), charged at deal).
casino_hit        { tableId }                         Pok-Deng, action phase, non-Pok 2-card hand.
casino_stay       { tableId }
casino_roulette_bets { tableId, bets:[{type,n?,amount}] }  Roulette, betting phase. Replaces this spin's bets (validateRouletteBets).
casino_leave      { tableId }                         = table_leave (refunds unsettled betting-phase escrow).
```
Server → table humans
```
casino_state  { tableId, game, phase, phaseEndsAt, serverNow, round, seats:[CasinoSeat], dealer?, history?, lastResult? }
casino_result { tableId, game, round, ... }  (per game below)
casino_error  { tableId, error }
```
CasinoSeat (pokdeng) = `{ seat, userId|null, name, isBot, bet, cheer, cards:[{r,s}]|null (hidden until deal), info:{points,pok,mult,label,deng}|null, action:'hit'|'stay'|null, settle|null, gold }`
Pok-Deng phases (ms from `CASINO.POKDENG.PHASE_MS`): `betting 4000 → deal 2000 → action 4000 → dealer 2000`.
- deal: seats with bet>0 get 2 cards; dealer 2 cards (2nd hidden until dealer phase); Pok seats auto-lock (`action:'stay'`).
- action: missing input = stay. dealer: `dealerShouldHit` → draw; settle each seat via `settlePokDeng`; credit `returned`,
  deduct `min(extraLoss, gold)`; chest roll `chestChance(bet,{cheer})` if `casino_daily.chests < CHEST_DAILY_CAP` → `bag_items.random_dupe_box += 1`.
- `casino_result { game:'pokdeng', round, dealer:{cards,info}, seats:[{seat, cards, info, settle, chest:boolean}] }`
Roulette phases (`CASINO.ROULETTE.PHASE_MS`): `betting 8000 → spin 5000 → result 2000`.
- spin start: `spinRoulette(seed)`; broadcast `strikes` immediately (lightning), `number` only at result phase.
- result: `settleRoulette(bets, spin)` per seat, credit `returned`. `bigHit` (≥100×) → global cheer (§5B).
- `casino_result { game:'roulette', round, number, color, strikes:[{n,mult}], seats:[{seat, total, returned, profit, wins, bigHit}] }`
- `history`: last 12 `{ number, color, strikes }`.
Seed per round: `seedFn() >>> 0` from the service rng (tests inject deterministic rng).
Wallet rule: escrow at bet time from `p.gold` (reject `insufficient_gold`). `p.casino_daily.net += profit`, `hands += 1`.

---------------------------------------------------------------------------------------------------------------------
## 5B. Town Hall, Hall of Fame, Global Cheer, Radar
### Town Hall instance
Client → `instance_switch { to:'townhall' | 'home' }`. Server moves presence: leaves current instance (broadcast
`player_left`), joins `townhall:main` (`TOWNHALL.ID`), sends `instance_snapshot { instanceId, layout:{ kind:'townhall', size:36 }, players:[...] }`
(same player shape as existing snapshots). `home` returns to `instanceFor(p)`. Movement clamp in town hall: `x,z ∈ [-18,18]`.
Landmarks (`TOWNHALL.LANDMARKS` in `shared/phase5_rules.js`, trigger radius 2.4 m or click):
```
fountain        (0,0)                       → open gacha/shard shop
statue_1..5     (-8,-13) (-4,-14) (0,-14.5) (4,-14) (8,-13) → Hall of Fame modal (statue_n = category n)
casino_palace   (-10.5,-5.5)                → Table Hub tab 'casino'
monopoly_arch   (10.5,-5.5)                 → Table Hub tab 'monopoly'
forge           (10,4.5)                    → Forge
owl_postbox     (-5,2.5)                    → Owl Inbox / Gift
vip_table_1..4  (-6,8) (6,8) (-11,2) (11,10) → Table Hub (sit)
```
### Hall of Fame (`server/daily_service.js`)
Categories (in order): `architect` (castle_lv*1000+comfort), `gear` (cp), `arcade` (arcade_best), `tycoon` (mono_stats.goldWon), `couple` (couple_streak).
```
hall_list    {}                  → { ok, day, worshippedToday, categories:[{ key, label, icon, rows:[{ rank, userId, username, value, title, cp, worship_count }] }] }  (top 10 each; statue = rows[0])
hall_worship {}                  → { ok, gold:200, diamonds:15, champions:[userId] }   once per UTC day ('already_worshipped'); each distinct champion worship_count += 1
```
### Global Cheer
Server helper `emitCheer({ winnerId, winnerName, achievement })` → registers `{ cheerId, winnerId, expiresAt: now+10000, claimed:Set }`
and broadcasts to all sockets `global_cheer_banner { cheerId, winnerName, achievement, expiresAt }`.
Sources: Forge +10, Celestial hair, Roulette bigHit (≥100×), Mythic gacha pull.
```
cheer_claim { cheerId } → { ok, gold:50 }   errors: 'cheer_expired' | 'already_cheered' | 'own_cheer'
```
### Radar (client only, zero new packets) — `client/js/town_hall_radar.js`
`#hud-mini-radar` (64×64, 10 Hz) · `#town-map-modal` (tap-to-expand; rows `[data-walk-x][data-walk-z]`) ·
`.wayfinder-edge-pill` (partner / in-call friend off-screen, `💞 name • 14m ↗`). Auto-walk uses new `world.walkTo(x,z)` (sets `input.tapTarget`).

---------------------------------------------------------------------------------------------------------------------
## 5C. Owl Gifts, VIP Cards, Passport, Couple Streak, Founder
```
owl_send_gift { to, slot1?: { kind:'gear', itemId, mode:'dupe'|'transfer' } | { kind:'decor', decId },
                    slot2?: { kind:'bag', key:'streak_freeze'|'vip_call_day_pass'|'vip_communicator'|'vip_telelink_box'|'vip_black' } | { kind:'berries', amount≤200 },
                    note?(≤80 chars, sanitized), ribbon?('pink'|'gold'|'sky'|'mint') }
   rules: sender level ≥ 10 ('level_too_low'); recipient exists ('no_such_user'), ≠ self, is partner or in p.friends ('not_friend');
          ≤ 3 parcels / UTC day ('daily_limit'); at least one slot ('empty_parcel'); postage 50 🍓 (25 if recipient = partner_id) ('insufficient_berries');
          gear dupe: inventory[itemId].dupes ≥ 1 → dupes−1, MailItem{refine:0,dupe:true};
          gear transfer: owned, dupes === 0, not equipped ('item_equipped') → delete from inventory, MailItem{refine:<preserved>,dupe:false};
          decor: village.decor[decId] ≥ 1 → −1; bag: bag_items[key] ≥ 1 → −1; berries: amount ≤ 200 and affordable (on top of postage).
   → { ok, mailId, postage, sentToday }   recipient gets Mail; if online: `owl_mail_arrived { mail }` + profile push.
owl_claim_mail { mailId } → { ok, granted:[MailItem] }  ('no_such_mail' | 'already_claimed')
   gear: if owned → refine = max(existing, incoming), dupes += 1 (dupe item: dupes += 1 only); else inventory[itemId] = { refine, dupes:0 }.
   decor → village.decor[decId] += count; bag → bag_items[key] += count; berries/diamonds → currency.
vip_card_buy { card:'call_day_pass'|'vip_communicator'|'telelink_box'|'black_vip', currency?:'diamonds'|'shards', target?, asGift? }
   prices: call_day_pass 300💎 (24h, stacks), vip_communicator 2500💎 or 200 shards (permanent self),
           telelink_box 4500💎 (permanent 2-way: target must be friend → both p.vip.telelinks include each other),
           black_vip 9900💎 (all friends callable + ticker +30💎). asGift → bag_items['vip_'+card] += 1 instead of activating.
vip_card_use { card } → activates a card from bag_items (telelink needs target).
passport_state {} → { ok, passport, quests:[{ key, label, goal, progress, reward, claimed }], bonus:{reward:30, claimed}, stamps }
passport_claim { quest:'play'|'harvest'|'pet'|'bonus' } → rewards 25/40/25 💎, bonus 30 💎 (+1 stamp, requires all 3 claimed).
   Every 7th stamp mails a system parcel: 2× ticket_standard + 100 💎.
   Progress hooks: `bumpQuest(p,'play')` on table match finish / casino hand settled; 'harvest' on village harvest; 'pet' on pet_interact. Goals: play 1, harvest 1, pet 3.
Couple streak (`onDailyLogin(p, partner, now)` from join/auth): p.login_day = today. If partner.login_day === today and
   p.couple_streak_day !== today → for BOTH: if couple_streak_day === yesterday → streak+1; else if missed and bag_items.streak_freeze ≥ 1 → consume 1, streak+1; else streak = 1.
   Set couple_streak_day = today; +20💎 each; streak % 7 === 0 → +170💎 +2 ticket_standard +1 streak_freeze; streak % 30 === 0 → +520💎. Emits `couple_streak_update { streak, rewards }`.
founder_claim { code? } → eligible if p.id ∈ FOUNDER_IDS ['nook','neen','beam','mochi','leo'] or (FOUNDER_CODE_ENABLED && code === 'SKYPARTY-V1');
   once ('already_claimed' | 'not_eligible'). Grants: titles += 'Sky Party Founder' (and equips p.title), +1000💎, bag_items.mythic_selector_box += 1, star_essence += 40.
```

---------------------------------------------------------------------------------------------------------------------
## 5D. Voice Calls (`server/voice_call_service.js` + `client/js/voice_call_client.js`)
```
call_invite  { to }              → callee: call_incoming { callId, from, fromName, vip }   caller: call_ringing { callId }
call_accept  { callId }          → both: call_connected { callId, peerId, startedAt, polite:boolean }
call_decline { callId }          → caller: call_ended { callId, reason:'declined' }
call_hangup  { callId }          → both: call_ended { callId, reason:'hangup', durationMs, chunks }
call_signal  { callId, data }    → relayed verbatim to the peer as call_signal { callId, data }  (SDP / ICE; ≤ 16 KB)
```
Permission (`canCall(caller, callee)`): partners always; else callee ∈ caller.friends AND (caller.vip.black || caller.vip.communicator ||
caller.vip.call_until > now || caller.vip.telelinks includes callee) → else 'call_locked'. Busy → caller `call_busy`. Offline → 'offline'.
Glare: A invites B while B→A ringing → merge into one session, caller = min(A,B), auto-connect.
Ring timeout 30 s → `call_ended {reason:'no_answer'}`. Disconnect grace 15 s (session survives a socket swap), then end.
Ticker: every 15 min of connected time → BOTH get +20💎 (+30 if either has vip.black) and +50 EXP → `call_reward { callId, diamonds, exp, chunks }`. Uncapped.
ICE config sent in `call_connected.ice` from server env (`TURN_URL/TURN_USER/TURN_PASS`) with Google STUN fallback.
```
