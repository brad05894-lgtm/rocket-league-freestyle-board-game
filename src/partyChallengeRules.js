// Player-facing instructions. Implementation notes from the source specification never render here.
const R = {
1:['Score more goals than the opposing side.','A tie goes to next-goal overtime.'],
2:['Take 3 valid attacks against the defender. An untouched miss is retried.','Compare attacking goals; resolve ties with paired extra attacks.'],
3:['Take 3 freestyle attempts. Judge each player’s best successful shot by difficulty, creativity and execution.','Tied players take extra attempts until their places are decided.'],
4:['Face 3 valid shots and count your saves. Retry invalid shots.','Most saves wins; resolve ties with paired extra shots.'],
5:['Take 3 crossbar attempts.','Most crossbar hits wins; tied sides take an extra attempt each.'],
6:['Everyone uses the displayed mechanic. Take 3 attempts each and count successful completions.','Tied players take 1 extra attempt each with the same mechanic. The host may reroll if everyone agrees to abandon the current round.'],
7:['The setter names and completes a mechanic; the required opponents copy it. A failed copy gives one letter. Two letters eliminates you.','Resolve every copier’s attempt before moving to the next setter. Last remaining player or team wins.'],
8:['Copy the current mechanic chain, then add a harder upgrade.','Failing to copy loses the duel. A failed upgrade starts a fresh chain with the other player setting.'],
9:['Play two-letter HORSE using air-based mechanics and a declared target.','A failed copy earns a letter. Complete all copying attempts before changing setter.'],
10:['Take 3 shots each. Enter each successful goal’s KPH; misses count as 0.','Highest total wins. Tied players take one extra shot each.'],
11:['Each round, every player gets exactly 1 Kuxir-pinch attempt. Keep taking one attempt each per round until somebody scores.','If exactly one player scores in a round, they win. If multiple players score in the same round, the fastest successful KPH wins. The browser does not track attempts or speed; the Host enters the final result.'],
12:['Start at 1 flip reset and climb one reset at a time. You have 3 attempts at each level.','Three misses at a level ends your run. Highest completed level wins; equal levels share a place.'],
13:['Attempt the displayed reset count once each.','If everyone fails, repeat that level. If anybody succeeds, failed players are eliminated and survivors advance.'],
14:['Play the displayed kickoff pairings and report each kickoff winner.','The app totals wins and schedules any required tiebreaks.'],
15:['Choose the same training pack. Race through shots 1–10 in order.','Press Finished after completing shot 10.'],
16:['Use the same long training pack. Complete as many shots as possible before time expires.','Enter completed-shot totals after the timer. Equal totals may tie.'],
17:['Play the match while driving in reverse. Kickoffs are exempt.','A tie goes to next-goal overtime under the same restriction.'],
18:['Randomize your car inside Rocket League. Keep that car for the entire Challenge, including tag-team segments.','Play a normal match. A tie goes to next goal.'],
19:['Use the randomly selected Rocket League mode shown here.','The host can reroll before play if everyone agrees. Keep the mode throughout the Challenge.'],
20:['Play upside down in turtle position with unlimited boost. No aerials.','A tie goes to next goal under the same restriction.'],
21:['Attackers privately receive a target. Report 2 points for a goal that hits it, 1 for another goal, or 0 for no goal.','After the shot, the defender locks a target prediction. Reveal both: a correct prediction earns the defender 1 point. Take 3 possessions per side; tied scores use paired extra possessions.'],
22:['The display draws Easy, Medium and Hard mechanics worth 1, 2 and 3 mini-points. Take 3 attempts total.','Before each attempt, declare any combination. Complete EVERY declared part in that attempt to earn their sum; otherwise earn 0. Track totals and report the winner.'],
'22b':['The display draws Easy, Medium and Hard mechanics worth 1, 2 and 3 points. Use Rocket League’s own 1:00 clock for each run.','During the minute, attempt as many shots as possible. Before each shot, declare any 1 mechanic or combination; every declared part must be completed in the scored shot to earn their sum. Misses or incomplete combos earn 0.','You may repeat the same mechanic or combo as many times as you can score it before Rocket League time reaches 0:00. Keep totals manually and report the result.'],
23:['GREEN = normal gameplay. YELLOW = normal controls but no boost. RED = release throttle, steering, boost, jump, flip and powerslide; do not intentionally brake to stop faster. Existing momentum, sliding, falling and airborne travel are allowed.','Lights are random. If the same color repeats, continue following that color until it changes.','Keep obeying the lights through next-goal overtime. The host ends the light system only when the Rocket League game is actually finished.'],
24:['Take 3 alternating attacks. At most one ground bounce is allowed after the attack starts.','A no-bounce goal earns 2 points; a one-bounce goal earns 1. A second bounce ends the attack; a save alone does not.'],
25:['Attack from midfield against a defender. Use 15 seconds, 10 seconds and 5 seconds once each per player.','Scoring earns 1, 2 or 3 points respectively. Start the timer when ready; after all possessions, compare totals. Ties use paired 5-second attacks.'],
26:['Take 3 pinch attempts each. Enter successful goal KPH; a miss is 0.','Highest combined KPH wins; tied players take 1 extra attempt each.'],
27:['Play Heatseeker.','Ties go to next goal.'],
28:['Complete the mechanic on an unclaimed square, then claim it. First to 3 in a row wins. There are no fixed attempt turns.','In 1v1v1v1, use the standard two-semifinal tournament, then Final and 3rd-place. A filled-board tournament draw is replayed until that matchup has one winner.'],
29:['Each round uses one Hard mechanic. Secretly bid 1–5 attempts. Lowest bid tries first; equal bids are randomly ordered.','The FIRST successful player earns 1 mini-point and ends the round. Play 3 rounds. Equal final totals may tie.'],
30:['Lock your KPH guesses before the host reveals the actual shot speed. Misses count as 0 KPH.','Lowest total absolute guessing error wins. Follow the assigned shooters and guessers.'],
31:['Use the same random mechanic for four rungs: any goal → top half → top corner → crossbar down.','You get 2 attempts per rung. Highest completed rung wins; completing all four guarantees a share of first.'],
32:['Play the selected short events in order. Each event has its own rules and must settle its event placements.','The app adds event points. Equal final FFA totals share a place.'],
33:['Complete the displayed Easy → Medium → Hard mechanics, in that order, within 60 seconds.','Mark each completion. Rank by most completed, then fastest completion times, comparing the latest completed rung first.'],
34:['Privately view your number from 1–10. Bank it, or risk it for ONE new number that you must keep.','Everyone locks their decision before the reveal. Highest number wins; equal numbers share a place.'],
35:['Demo Royale: one life each. A demo eliminates you; eliminated players stay out.','Last surviving player or team wins. Report genuinely simultaneous eliminations together.'],
36:['Players choose or randomize an official Rocket League arena themselves before the matchup. The browser does not select the arena.','Play the required match / tournament / tag-team segments normally. The browser only records results and progression.'],
37:['Complete a valid mechanic starting with the displayed letter. First to 3 successes wins.','After a success, draw a new letter. Previously successful mechanics cannot be reused, even if their letter repeats.'],
38:['Stay airborne. Ground or wall contact eliminates you; ceiling touches are allowed. Bumps and demos are allowed.','Eliminated players stay out. Last remaining player or team wins.'],
39:['The assigned shooter announces a KPH estimate. Opponents secretly choose Higher or Lower, then reveal the actual speed.','A correct prediction earns 1 mini-point; speed exactly equal to the estimate earns nobody a point. Final ties remain ties.'],
'40a':['Hidden Hot Potato: stay in your assigned half. SKIP ALL REPLAYS immediately.','After a hidden 10–60 seconds, the side containing the ball loses. A goal explosion belongs to that goal’s half. If the ball is at center, play the kickoff and use the first half it enters.'],
'40b':['Hidden Hot Potato: move freely across the field. SKIP ALL REPLAYS immediately.','After a hidden 10–60 seconds, the side containing the ball loses. A goal explosion belongs to that goal’s half. If the ball is at center, continue the kickoff until it enters a half.'],
41:['Start a goal-speed chain. On your turn, score strictly faster than the last valid speed. Equal speed fails.','You have 2 hearts. After a failure, begin a new chain; after elimination, remaining players get a fresh order.'],
42:['Score a goal within 60 seconds, then stop the timer and enter its KPH. Each valid goal must be no faster than the current baseline.','A higher speed or timeout costs a heart; 2 lost hearts eliminates you. A valid 0 KPH goal eliminates the next player and resets the baseline.'],
43:['One air-dribble endurance attempt each. Another player operates your timer. You must finish with a valid goal or score 0.','Stop the timer, then confirm validity. Longest valid time wins; tied placements get extra runs.'],
44:['Complete your personal mechanic to pull the rope toward your side. Rerolling gives the other side 1 pull.','Only the first submission for your current mechanic counts. Reach your endpoint to win.'],
45:['Play with no boost.','Normal match scoring; ties go to next goal.'],
46:['Play with unlimited boost.','Normal match scoring; ties go to next goal.'],
47:['On your turn, say one valid Rocket League car that has not already been used. You have 10 seconds.','After you say it, YOU press “I said an unused answer” to immediately pass the turn. If the answer is later caught as invalid/repeated, the Host may redo only that last player’s turn using the time they had remaining when they passed.','A timeout eliminates that player.'],
48:['On your turn, say one valid Rocket League pro, player, freestyler, or established creator that has not already been used. You have 10 seconds.','After you say it, YOU press “I said an unused answer” to immediately pass the turn. If the answer is later caught as invalid/repeated, the Host may redo only that last player’s turn using the time they had remaining when they passed.','A timeout eliminates that player.'],
49:['The bomb moves continuously toward one side. Only the threatened side may answer with a valid unused Rocket League car name.','A correct answer reverses it from its current position. If it reaches your end, you lose.'],
50:['The bomb moves continuously toward one side. Only the threatened side may name a valid unused Rocket League player or creator.','A correct answer reverses it from its current position. If it reaches your end, you lose.'],
51:['Play Multiball: 2 balls for 1v1, 4 balls for 2v2.','First side to score 2 goals wins. Report goals manually.'],
52:['Play normal browser Tic-Tac-Toe with randomly assigned X/O and first turn. Alternate claiming empty squares; three in a row wins.','In 1v1v1v1, use the standard four-player tournament. A filled-board tournament draw automatically replays that matchup until it has one winner.'],
53:['Play using the agreed Boomer Ball settings.','Normal match scoring; next goal breaks a tie.'],
54:['Everyone sets FOV to the minimum for the entire match.','Ties go to next goal while keeping minimum FOV.'],
55:['Aim for the displayed target from 1–150 KPH. Take one valid goal each; retry a miss.','Closest goal speed wins. Tied players get a fresh target and repeat until separated.'],
56:['Stand up while playing the match.','Keep standing through any next-goal overtime.'],
57:['Simultaneously call one mechanic or shot requirement each. Combine the requirements, then race to score that shot.','A valid completion must satisfy every requirement. Both players must agree before abandoning an unrealistic combination and making fresh calls.'],
58:['Do not use free Air Roll or either Directional Air Roll. All other controls are allowed.','Keep the restriction through next-goal overtime.'],
59:['Play Bullet Ball with 3 lives per player.','Report life losses; eliminated players stay out. Last surviving player or team wins.'],
60:['Play Knockout with 3 lives per player.','Report life losses; assigned teammates cooperate even if the Rocket League lobby is FFA. Last surviving team or player wins.'],
61:['Each duo takes 3 team-pinch attempts, alternating teams. Both teammates must be involved.','Use each team’s best successful goal KPH. Misses are 0; tied teams take an extra attempt each.'],
62:['Each duo takes 3 team-pinch attempts, alternating teams. Both teammates must be involved.','Add all 3 goal speeds; misses are 0. Tied teams take an extra attempt each.'],
63:['Team HORSE: one duo sets a two-player mechanic and the other duo copies it.','A failed copy earns a team letter; 2 letters loses. Rotate the setting team after copying.'],
64:['Play the two displayed 1v1 matchups for 2 minutes each. Add goals by team.','If team totals tie, the second matchup plays next-goal overtime.'],
65:['Play a 3-minute 2v2 match with the displayed random teams, but compete for INDIVIDUAL goals.','Enter each player’s goal count. Rank individually; equal totals share a place.'],
66:['The duo has 60 seconds to score 3 goals against the solo defender.','Duo wins at 3; solo wins if time expires with 2 or fewer allowed.'],
67:['The solo attacker has 60 seconds to score once against the duo.','Clear/reset as agreed without stopping the clock. One goal wins for solo; timeout wins for the duo.'],
68:['Play for 60 seconds. The solo player starts with a +2 browser-score advantage.','Report goals for either side. If adjusted scores tie, next goal wins.'],
69:['The solo plays each duo member in a separate 2-minute segment. Add goals by side.','If totals tie, the second matchup plays next-goal overtime.'],
70:['Solo gets 3 Medium mechanics against duo Easy, OR solo Hard against duo Medium.','Each mechanic gets one attempt per player. Solo earns a point for success; the duo earns a point only if BOTH succeed. A tie repeats the SAME mechanics.'],
71:['One runner gets an 8-second head start, then two hunters get 60 seconds to demo them. Ground-only.','Runner survives to win; hunters win with the demo.'],
72:['One hunter has 2 minutes to demo BOTH runners. Ground-only.','A demoed runner parks and stays out. Hunter wins only by eliminating both before time expires.'],
73:['Solo starts deep with the ball; the duo presses from midfield.','Solo wins by touching the opposite back wall with the ball. Duo wins by stealing and scoring first. No timer.'],
74:['Both sides use the displayed mechanic. Solo gets 2 attempts; each duo member gets 1.','Any teammate success makes that side successful. If both sides succeed or both fail, draw a new mechanic; otherwise the successful side wins.'],
75:['Both sides use the displayed mechanic. Solo gets 3 attempts; each trio member gets 1.','Any teammate success makes that side successful. If both sides succeed or both fail, draw a new mechanic; otherwise the successful side wins.'],
76:['The trio has 2 minutes to score 5 goals against the solo defender. No demos.','Trio wins at 5 goals; solo wins if time expires first.'],
77:['Solo has 2 minutes to score once against the trio. No demos.','Clear/reset without stopping the clock. Solo wins on a goal; trio wins on timeout.'],
78:['Solo races to complete a one-bounce Kuxir. The trio completes its assigned Easy → Medium → Hard relay.','Trio members must finish in the displayed order. First side to finish wins.'],
79:['Boosted solo shark tries to demo runners who cannot boost. Cross the field in the displayed direction.','Demoed runners are out. Surviving runners regroup after every crossing; at least one must survive all 3 crossings (duo) or 5 (trio).'],
80:['Check your PRIVATE role. Non-imposters share a secret prompt; the Imposter must blend in.','Do the shot clues fluidly on your own with no browser turn order. When ready, the Host starts a 2:00 discussion; the Host may end discussion early and open the secret vote.','A tied vote returns to a free extra-clue phase using the same roles/prompt, followed by another 2:00 discussion and revote.'],
81:['Check your PRIVATE role. Give verbal clues fluidly on your own with no browser turn order and without revealing the secret word.','When ready, the Host starts a 2:00 discussion; the Host may end it early and open the secret vote. A tied vote returns to a free extra-clue phase, then another discussion and revote.'],
82:['The solo boss secretly chooses 1 of 3 mechanics. The team picks a challenger, who gets 2 attempts. Failing both eliminates them.','Do not choose the same challenger twice in a row unless they are the only survivor. Boss wins by eliminating everyone; the team wins by surviving 4 rounds (duo) or 6 (trio).'],
83:['Play for 2 minutes. Solo scores by touching the opposite back wall; trio scores normal goals.','Pause the browser clock after each point and resume when reset. If tied, the next qualifying point wins.'],
84:['Solo sets a mechanic with one attempt. A miss automatically gives the team a survived round.','If solo succeeds, EVERY teammate gets one copy attempt. Any success survives the round; all failing gives solo the win. Team wins after 3 survived rounds (duo) or 4 (trio).'],
85:['Play the four-player bracket. Each matchup independently draws a Sprint event.','Semifinals may run together. After both finish, choose simultaneous or sequential final/third-place matches. Each matchup must have one winner.'],
86:['Play the four-player bracket. Each matchup independently draws a game from the approved roulette pool.','After both semifinals finish, play the final and third-place matches together or one at a time.'],
87:['Play the four-player bracket, choosing/randomizing each matchup’s Rocket League mode yourselves.','Use the browser to record bracket winners. Each match needs one winner; then play final and third place.'],
88:['Configure native Rumble before starting. Power-ups are fully allowed and remain active for the whole match.','Use Rumble’s normal scoring. Ties continue to the next valid goal.'],
89:['Configure native Dropshot on a valid Dropshot arena before starting.','Use Dropshot’s normal goal / score result. The browser does not track floor tiles or damage.'],
90:['Configure native Hoops on a valid Hoops arena before starting.','Use normal Hoops scoring. Ties continue to the next valid basket.'],
91:['Configure native Snow Day before starting and play with the puck.','Use normal Snow Day scoring. Ties continue to the next valid goal.'],
92:['The browser starts with a random 200–500 KPH total and random surviving-player order. On your turn you have 1:00 to score and enter the goal KPH.','Your KPH is subtracted from the remaining total. Going below 0 busts and eliminates you; hitting exactly 0 eliminates the NEXT surviving player. After every elimination, a fresh 200–500 total and fresh surviving-player order are generated.','In 2v2, everyone takes individual turns; the last surviving team wins.']
}
const PLAY_DETAILS = {
  3: ['A missed shot cannot be your scored freestyle. Compare each player’s best shot, rather than adding all attempts.'],
  7: ['Letters are elimination marks, not Tokens. A setter must complete the shot before opponents are asked to copy it.'],
  8: ['The upgrade must build on the existing chain. Agree what must be copied before the next attempt.'],
  9: ['State the target before setting the shot so opponents know exactly what they must reproduce.'],
  10: ['Use the goal speed shown by Rocket League, not the speed the ball reached earlier in the shot.'],
  12: ['Completing a level moves you to the next reset count. Record your highest completed level, not the level where you ran out of attempts.'],
  13: ['An eliminated player stops taking attempts. The reset count rises only after the current level has a successful survivor.'],
  15: ['Everyone must use the same pack and shot order. Do not skip a difficult shot to finish sooner.'],
  16: ['Only completed shots before the timer ends count. An unfinished shot at the buzzer adds nothing.'],
  21: ['Keep the assigned target private until the prediction is locked. Attacking points and prediction points are separate, so both can score on the same possession.'],
  22: ['The 1 / 2 / 3 values are points within this Challenge, not the normal board mechanic payouts. A partial combination earns nothing.'],
  24: ['Track ground bounces throughout the same attack. A defender’s touch does not reset the bounce count.'],
  25: ['Each time allowance is used once; the shorter attacks are worth more. A possession without a goal earns 0.'],
  26: ['Count only goal speeds from valid pinches. Record all attempts, including misses, before comparing totals.'],
  28: ['Choose an empty square to work toward. Completing a different mechanic does not let you claim that square.'],
  29: ['Keep bids private until everyone has locked in. If the first bidder fails all their allotted attempts, the next bidder gets a chance.'],
  30: ['Guessing error is the distance from the actual speed: guessing 90 for a 100 KPH shot gives 10 error. Lower is better.'],
  31: ['Keep the same mechanic as its placement requirement becomes harder. Failing both attempts at a rung ends that player’s climb.'],
  33: ['Do not work ahead: finish Easy before Medium, and Medium before Hard. Stop attempting when the timer ends.'],
  34: ['A reroll can be lower than your original number. You cannot return to the old number or roll a third time.'],
  35: ['Once eliminated, do not rejoin or interfere with survivors. Record eliminations as they happen so placement order stays clear.'],
  37: ['The mechanic must match the current letter and be completed successfully. Calling its name alone does not score.'],
  38: ['Touching a wall also ends your run, even if you could jump back into the air. Ceiling contact is the stated exception.'],
  39: ['Lock predictions before revealing the measured speed. “Higher” and “Lower” are strict: matching the estimate scores neither.'],
  41: ['Equal KPH is not a successful increase. Record the goal speed after every valid shot so the next player knows the number to beat.'],
  42: ['A slower goal is valid; a faster one is not. Keep the measured goal speed visible when reporting your result.'],
  43: ['A long air dribble without the required finishing goal is worth 0. Confirm the finish before accepting the recorded time.'],
  47: ['Listen to earlier answers so you do not repeat a name. If the immediately previous answer was invalid/repeated, the Host can return only that player using the time they had left when they passed.'],
  48: ['Listen to earlier answers so you do not repeat a name. If the immediately previous answer was invalid/repeated, the Host can return only that player using the time they had left when they passed.'],
  49: ['Do not answer while the bomb is travelling away from your side. Reversing it does not send it back to the middle.'],
  50: ['Do not answer while the bomb is travelling away from your side. Reversing it does not send it back to the middle.'],
  51: ['Set up the required number of balls before starting. Keep track of goals by side and stop as soon as a side reaches 2.'],
  52: ['Choose only an empty square on your turn. A horizontal, vertical or diagonal line of 3 counts.'],
  55: ['Compare absolute error: 95 and 105 are equally close to a 100 KPH target. A missed goal must be retried, not entered as 0.'],
  57: ['Attempt the combined shot simultaneously, with no alternating turns. Both players must agree before discarding an unrealistic combination and making fresh calls.'],
  92: ['Only enter the KPH shown for a scored goal. The remaining number is shared, so wait for your turn and watch the subtraction before the next player shoots.'],
  61: ['Record all three attempts, but only the fastest successful team goal decides the result.'],
  62: ['Every attempt contributes to the total. One very fast goal does not replace the other two attempts.'],
  65: ['Your temporary teammate’s goals do not add to your individual score. Final Challenge placements use each player’s own total.'],
  70: ['One teammate succeeding is not enough for the duo’s point: both must make their own attempt.'],
  71: ['Hunters wait out the head start before chasing. A successful demo ends the round immediately.'],
  72: ['Eliminated runners cannot return to distract the hunter. Leaving either runner alive at the buzzer gives the runners the win.'],
  73: ['The ball must touch the opposite back wall; simply reaching the opponents’ half is not enough.'],
  74: ['Count success by side, not by the total number of completions. One success is enough to qualify that side.'],
  75: ['Count success by side, not by the total number of completions. One success is enough to qualify that side.'],
  78: ['The next relay player begins only after the previous mechanic is completed. The solo player works on their Kuxir throughout the relay.'],
  79: ['Finish and regroup before beginning the next crossing. Eliminated runners cannot return for a later crossing.'],
  82: ['Only the selected challenger attempts that round’s mechanic. Surviving means completing it within their two attempts.'],
  83: ['The solo’s wall touch and the trio’s goal are different scoring conditions. Reset after either kind of point before resuming the clock.'],
  84: ['Finish all required copy attempts before deciding that the team failed. One successful teammate is enough to survive that round.']
};
const timedMatches=new Set([1,17,18,19,20,23,27,36,45,46,53,54,56,58,88,89,90,91])
export const needsBattleAudio = g => !!g && ((['light','bomb','potato','names','reverseSpeed','gauntlet','timedGoals','hunt','endurance','pressure'].includes(g.engine)||g.engine==='possession'&&g.challengeId==='challenge-25') || Object.values(g.matches||{}).some(needsBattleAudio))
export function playerRules(g) {
 const key=g.challengeId.replace('challenge-',''),n=parseInt(key),draftRush=key.toLowerCase()==='22b',asym=['1v2','1v3'].includes(g.format),team=g.format==='2v2',ffa=g.format.includes('1v1v1');
 let lines=[...(R[key]||['Follow the displayed Challenge controls and report outcomes from Rocket League.'])];let setup=[],browser=[];
 if(timedMatches.has(n)) setup.push(g.engine==='series'?'Play each displayed head-to-head segment for 1 minute; add goals across segments.':team?'Set a 3-minute match.':'Set a 2-minute match.');
 if([88,89,90,91].includes(n)){const mode={88:'Rumble',89:'Dropshot',90:'Hoops',91:'Snow Day'}[n];setup.unshift('Configure Rocket League for '+mode+' before starting.');if(g.format==='1v1v1')setup=['Configure Rocket League for '+mode+' before starting.','Play a 3-match round robin: every pair plays once for 1 minute. Each mini-match must produce a winner; rank by mini-match wins.'];}
 if(g.engine==='tournament'&&n!==85&&n!==86&&n!==87)setup.push('Play the semifinals, then the final and third-place match. Each matchup uses the 1v1 rules below.');
 if(asym&&timedMatches.has(n)&&g.engine!=='series')lines.push('Multiply the solo player’s goals by '+(g.format==='1v2'?2:3)+' before comparing scores.');
 if(n===1&&asym)lines.push('Do not chase demos.');
 if(n===2&&asym)lines=['Solo defends 3 valid attacks from EACH teammate.','Compare team goals against solo saves. Equal scores are a draw.'];
 if(n===4&&asym)lines=['Solo attacks each opposing defender 3 times.','Compare solo goals against combined defender saves. Equal scores are a draw.'];
 if(n===5&&asym)lines=['Solo attempts crossbar hits; each teammate attempts crossbar-in goals. Take 3 attempts each.','Compare solo hits against the team’s combined qualifying goals.'];
 if(n===6&&asym)lines[0]='Use the same mechanic. Solo gets '+(g.format==='1v2'?4:3)+' attempts; each teammate gets '+(g.format==='1v2'?2:1)+'. Compare solo successes against combined team successes.';
 if(n===11)lines=['Every active player gets exactly one Kuxir-pinch attempt in the round. If nobody scores, start another one-attempt-each round.','If exactly one player scores in a round, that player wins. If multiple players score in the same round, only those scorers compare KPH; fastest successful pinch wins.','In 2v2, the winning player wins for their team. The browser does not track attempts or speed; the Host records the final result once players settle it.'];
 if([10,26].includes(n)&&asym)lines.push('Multiply solo’s total by '+(g.format==='1v2'?2:3)+' and compare against the team’s combined total.');
 if([10,22,26].includes(n)&&team)lines.push('Add teammates’ scores for the team total.');
 if(draftRush){setup.push('Use Rocket League’s own 1:00 clock for each player’s run. The browser does NOT run a timer.');if(asym)lines.push('Multiply the solo player’s total by '+(g.format==='1v2'?2:3)+' and compare it with the teammates’ combined total.');lines.push('If the required result is tied, draw a fresh Easy / Medium / Hard set and give only the tied players/sides another full 1-minute Rocket League-time run. Repeat if needed.');}
 if(n===14)lines=[g.format==='1v1'?'First to 2 kickoff wins.':g.format==='1v1v1'?'Play 3 kickoffs for every pairing. Add each player’s wins; tied places replay.':team?'Each player faces both opponents once. Add team wins; repeat the set if tied.':g.format==='1v2'?'Solo plays 2 kickoffs against each teammate. A 2–2 total is a draw.':g.format==='1v3'?'Solo plays one kickoff against each teammate. Most wins takes the Challenge.':'Each bracket matchup plays up to 3 kickoffs; first to 2 wins.','Report each kickoff winner using the displayed pairing.'];
 if(n===15)lines.push(asym?'Time each player separately. Compare solo time with the average teammate time; lower wins.':team?'The first individual to finish wins for their whole team.':'Finish order determines placements.');
 if(n===16)setup=[asym?'Solo gets '+(g.format==='1v2'?2:3)+' minutes; each teammate gets 1 minute. Compare solo completed shots against the team sum.':'Use a 2-minute browser timer.'];
 if([16,31,34,43].includes(n)&&team)lines.push('Compare each team’s best individual result.'+(n===31?' Use the second teammate’s result if the best results tie.':''));
 if(n===23){
  if(g.format==='1v3')lines.push('Trio timing: GREEN 30% for 7.5–12s, YELLOW 47% for 8.5–13s, RED 23% for 3–4.5s.');
  else if(g.format==='1v2')lines.push('Duo timing: GREEN 42% for 9–15s, YELLOW 36% for 7.5–12s, RED 22% for 3–6s.');
  else lines.push('Light timing: GREEN 42% for 9–13.5s, YELLOW 36% for 7.5–11.5s, RED 22% for 3–4.5s.');
  if(asym)lines.push('Only the duo/trio obeys the traffic light. Solo plays unrestricted.');
  browser.push('The whole screen receives a strong translucent tint. A voice/sound cue plays only when the color actually changes.');
 }
 if(n===30)lines.push(asym?'Solo shoots 3 times. The team captain guesses each. The team wins if combined error is at most '+(g.format==='1v2'?25:20)+' KPH; otherwise solo wins.':team?'Both opponents guess each shooter’s speed. Add teammates’ errors.':'Each player shoots once, and everyone guesses each shot. FFA tied errors share a place.');
 if(n===32)lines.push(asym?'Each teammate faces solo in a different event. In 1v2, a 1–1 split draws a deciding event and a random teammate.':ffa?'Event points: '+(g.ids.length===4?'4 / 3 / 2 / 1.':'3 / 2 / 1.'):'Each event win earns your side 1 mini-point. Play all 3 events.');
 if(n===39)lines.push(asym?'Follow the assigned solo shots and team captain’s predictions.':'Play '+(g.format==='1v1'?'3':'2')+' complete shooter rotations.');
 if(n===40&&g.format==='1v1v1v1')setup.push('Begin with 2v2. The winning pair plays the final; the losing pair plays for third. Each match has its own hidden timer.');
 if(n===43&&asym)lines.push('Multiply solo’s valid time by '+(g.format==='1v2'?2:3)+'; compare with the sum of teammate times.');
 if(n===44&&asym)lines.push('A solo success pulls '+(g.format==='1v2'?2:3)+'; a teammate success pulls 1. Any reroll gives the opposition only 1 pull.');
 if(n===55&&asym)lines.push('Compare solo’s absolute error with the average teammate error.');
 if(n===55&&team)lines.push('Compare the sum of each team’s absolute errors.');
 if([33,59,60].includes(n)&&g.engine==='series')setup.push('Play one mini-match against each teammate. Mini-match winners earn one side point. '+([59,60].includes(n)?'Each mini-match uses ONE life.':'Each mini-match gets a fresh draft.'));
 if([47,48].includes(n))browser.push('The browser owns the 10-second turn timer. Only the active player gets the answer button; all other players and the host are locked out of that button until their own turn.');
 else if(g.engine==='tournament'||g.engine==='potatoTournament')browser.push('The browser tracks the bracket. Semifinals run together; after both finish, the host chooses whether Final and 3rd Place run together or sequentially.');
 else if(['names','reverseSpeed','gauntlet','timedGoals','hunt','endurance','pressure','airdribble','sprint'].includes(g.engine))browser.push('Use the shared browser timer and on-screen controls so every device stays on the same state.');
 else if(draftRush)browser.push('The browser only displays/rerolls the draft and records the result. Use Rocket League’s own clock for the 1-minute run; there is no browser countdown.');
 else if(['manual','mechanic','draft','mode','arena','light','sprintJudge'].includes(g.engine))browser.push('Play the Rocket League portion using these rules, then use the on-screen result controls to confirm the outcome.');
 if(PLAY_DETAILS[n]) lines.splice(1,0,...PLAY_DETAILS[n]);
 if(n===11)lines=['Every active player gets exactly one Kuxir-pinch attempt in the round. If nobody scores, repeat with another one-attempt-each round.','If exactly one player scores, they win immediately. If multiple players score in the same round, the fastest successful KPH among those scorers wins; tied fastest scorers repeat one attempt each.','For 2v2, that individual winner wins for their team. Players keep track themselves and the Host records the final result.'];
 if(n===12)lines=['Start at one flip reset. You get three attempts at each reset count. A successful goal advances you to one more reset.','Three misses at a level ends your run. Keep track of your completed level yourselves.','Highest completed level wins; equal levels share a place. The host enters the final result.'];
 if(n===13)lines=['Start at one reset, with one attempt per player at that level. Track resets and successes yourselves.','If everyone misses, repeat the same level. If anyone scores, players who missed are eliminated and survivors move up one reset.','Continue until the winner and placement order are decided, then tell the host the result.'];
 if([7,8,9,63,74,75,84].includes(n))lines.push('Track letters, attempts and eliminations yourselves. Once the result is decided, the host records the winner or final placements.');
 if(n===14){lines=lines.filter(x=>!x.includes('Report each kickoff'));lines.push('Keep track of the kickoff results yourselves. The host records the overall winner or placements after the set is finished.');}
 if(n===16){lines=['Everyone uses the same long training pack in its normal shot order.','When your timer expires, submit the shot number you ended at. Only you submit your own result.','Higher ending shot number wins; equal results may tie.'];if(team)lines.push('Use each duo’s highest individual ending shot number.');if(asym)lines.push('Compare the solo ending shot number against the sum of the teammates’ ending shot numbers.');setup=setup.map(x=>x.replace('completed shots','ending shot number'));}
 if(n===22){lines=['Everyone uses the same displayed Easy, Medium and Hard mechanics, worth 1, 2 and 3 points per completion.','Follow the displayed random player order. '+(draftRush?'Each player has one 60-second run using Rocket League’s clock.':'Each player takes all three attempts before the next player begins.'),'Declare your mechanic or combination before the shot. Multiple different mechanics and repeated copies of the same mechanic can be combined: three qualifying flip resets earn three times the reset value.','All declared parts must be completed in the scored shot; a miss or incomplete combination earns 0. '+(draftRush?'Enter the total successful counts from your run.':'Enter each successful count after the attempt, or select Missed for 0.'),'Compare '+(team?'combined teammate totals':asym?'the solo total multiplied by '+(g.format==='1v2'?2:3)+' against the team sum':'point totals')+'. Tied players or sides receive a fresh shared draft and repeat the full '+(draftRush?'minute':'three attempts')+'; settled FFA placements remain fixed.'];}
 if(n===24)lines=['Begin near your own side of midfield against the defending opponent'+(team?'s':'')+'. Each attacking '+(team?'team':'player')+' takes three possessions, then switch attackers.','After the attack begins, the ball may touch the ground at most once. A save or clear alone does not end a playable attack or reset the bounce count.','A goal with no ground bounce is worth 2 points. A goal with one bounce is worth 1. A second bounce or no goal is worth 0.','The attacker reports each result after the possession. '+(team?'Combine teammates’ points.':'Compare points after both players finish.')+' If tied, each attacker gets one extra possession; repeat paired extra possessions until separated.'];
 if(n===25)lines=['Attack from midfield against the defender. Each attacking side uses 30 seconds, then 20 seconds, then 10 seconds once each.','Start your possession timer when ready. A goal within 30 / 20 / 10 seconds earns 1 / 2 / 3 points respectively. No goal within the time limit earns 0.','After each possession, the attacker reports Goal or No goal. '+(team?'Add teammates’ points.':'Compare each player’s points.')+' Finish every scheduled possession before comparing.','If tied, each attacker gets one extra 10-second possession, worth 3 points for a goal. Repeat until the totals separate.'];
 if(n===30){lines=lines.map(x=>x.replace('before the host reveals','before the shooter reveals').replace('Misses count as 0 KPH.','Use the first successful shot; retry misses.'));}
 if(n===36)lines=['Players choose or randomize an official Rocket League arena themselves before each matchup. The browser does not choose, display, or reroll the arena.','Play the required match, tournament, or tag-team segment normally. The browser only records results and progression; ties go to the next goal.'];
 if(n===37)lines=['The host selects Choose letter when everyone is ready. Complete a valid mechanic beginning with the displayed letter.','First to three successful mechanics wins. After a success, wait for the host to choose the next letter.','A mechanic already scored during this Challenge cannot be reused, even if its letter repeats.'];
 if([47,48].includes(n))lines=['On your turn, say one valid, unused Rocket League '+(n===47?'car name.':'pro, player, freestyler or established creator name.'),'You have 10 seconds. After a valid answer, press your answer button to pass immediately to the next player.','A repeated or invalid answer does not eliminate you immediately. Keep trying with a different answer before your timer expires.','Running out of time eliminates you. '+(team||asym?'The last surviving side wins.':'The last remaining player wins; elimination order determines other placements.')+' Only the current player sees their countdown.'];
 if([49,50].includes(n))lines.push('Wait for Start before beginning. Repeated or invalid names do not reverse the bomb; give a different valid answer before it reaches your endpoint.');
 if(n===55&&g.format==='1v1')lines=['A target speed from 1–150 KPH is revealed. Each player scores one valid goal; retry misses.','Submit your own measured goal speed. Lower absolute distance from the target wins the round: 95 and 105 are equally close to 100.','Best of three: first to two round wins takes the Battle. Each new round receives a fresh target.','If the errors tie, show the tie notice and repeat with a fresh target. A tied attempt does not award either player a round win.'];
 if([59,60].includes(n))lines=['Play '+(n===59?'Bullet Ball':'Knockout')+' using its normal in-game elimination system.','Only press “I am eliminated” once you are fully out of the Rocket League game. Do not report individual life losses.','Remaining players keep playing. '+(team||asym?'Assigned teammates cooperate; the last surviving side wins.':'Last survivor places first; earlier eliminations determine the other placements.')];
 if(n===57&&g.format==='1v1v1')lines=['All three players simultaneously call one mechanic or requirement each. Combine all three and race to score that shot.','A valid completion meets every requirement. The first scorer takes first place; the remaining two make a fresh two-part combination to decide second and third.','Only abandon an unrealistic combination if everyone involved agrees.'];
 if(n===44) lines=[
  'Everyone attempts their own displayed mechanic at the same time. Teammates do not have to complete the same shot.',
  asym?'Each solo completion pulls '+(g.format==='1v2'?2:3)+' spaces; each teammate completion pulls 1.':'Each completed mechanic pulls the shared marker 1 space toward your side.',
  'After a completion, only that player receives a new mechanic. Everyone else continues their current one.',
  'You may reroll your own mechanic, but the opposing side immediately gains 1 space. This penalty is always 1, including for the solo player.',
  'Reach or pass your endpoint to win: '+(g.format==='1v1'?3:g.format==='1v2'?4:5)+' spaces from the middle. An opponent’s pulls move the same marker back toward their end.'
 ];
 if(n===80||n===81) lines=[
  'Privately check your role. One player is the imposter; everyone else shares the same secret '+(n===80?'shot prompt.':'word or phrase.')+' Keep your role and answer hidden.',
  n===80?'Give shot clues fluidly on your own. There is no browser turn order: take turns naturally and stop when the group feels it has enough clues.':'Give verbal clues fluidly on your own. There is no browser turn order: speak naturally without saying the secret answer.',
  'Discuss after the clues, then secretly vote for another player. The player with the unique highest vote count is accused.',
  'A tied highest vote is not a draw: everyone gives one more clue and votes again. You may vote for any other player, not just the tied suspects.',
  'If the accused player is innocent, the imposter wins immediately. There is no second accusation.',
  'If caught, the imposter gets one exact '+(n===80?'prompt':'word or phrase')+' guess. A correct guess steals the win; an incorrect guess means the non-imposters win.'
 ];
 if([85,86,87].includes(n)) lines=[
  'Start with the two displayed semifinal pairings. Each matchup is a separate 1v1, and the semifinals can run at the same time.',
  n===85?'Each matchup independently draws a Sprint event. Read that matchup’s attempts, scoring and tiebreak rules before starting.':n===86?'Each matchup independently draws a game from the approved pool. Read its own rules before starting.':'Choose or randomize the Rocket League mode for each matchup yourselves, and agree its settings before starting.',
  'Report one winner for each semifinal. The winners advance to the final; the other two players contest third place.',
  'Once both semifinals are complete, play the final and third-place match together or one at a time.',
  'Every matchup must settle on one winner using its game’s tiebreak rules. The final determines first and second; the other match determines third and fourth.'
 ];
 if(g.engine==='tournament'&&![85,86,87].includes(n)) setup.push('Semifinal winners play for first and second; the others play for third and fourth. Settle every matchup before reporting its winner.');
 if([24,25].includes(n)&&team)lines.push('Both teammates attack together against both defenders. The first named teammate reports the team possession result.');
 if([24,25].includes(n)&&g.format==='1v1v1')lines.push('Each player attacks against the next player in the displayed order, wrapping back to the first. Complete the same number of possessions each.');
 if(g.format==='1v1')lines=lines.map(x=>x.replace('player or team','player').replace('players or teams','players').replace('teammates’','players’').replace('team totals','player totals'));
 if(g.playerChosen)return {setup:['Choose the Rocket League mode yourselves.'],lines:['Agree the settings before starting. Play to one winner and report the result here.'],browser:['The browser only tracks the bracket/result; it does not choose or validate your Rocket League mode.']};
 return {setup,lines,browser:[]};
}
