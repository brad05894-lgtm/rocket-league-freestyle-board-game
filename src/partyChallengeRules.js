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
11:['Use Kuxir pinches. Successful goals count; misses are 0.','Compare KPH using the controls below.'],
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
23:['GREEN = normal gameplay. YELLOW = normal controls but no boost. RED = release throttle, steering, boost, jump, flip and powerslide; do not intentionally brake to stop faster. Existing momentum, sliding, falling and airborne travel are allowed.','Lights are random and the same color may appear again. A repeated color simply continues with a new random duration; the browser does not replay the voice/sound cue unless the color actually changes.','Keep obeying the lights through next-goal overtime. The host ends the light system only when the Rocket League game is actually finished.'],
24:['Take 3 alternating attacks. At most one ground bounce is allowed after the attack starts.','A no-bounce goal earns 2 points; a one-bounce goal earns 1. A second bounce ends the attack; a save alone does not.'],
25:['Attack from midfield against a defender. Use 15 seconds, 10 seconds and 5 seconds once each per player.','Scoring earns 1, 2 or 3 points respectively. Start the timer when ready; after all possessions, compare totals. Ties use paired 5-second attacks.'],
26:['Take 3 pinch attempts each. Enter successful goal KPH; a miss is 0.','Highest combined KPH wins; tied players take 1 extra attempt each.'],
27:['Play Heatseeker.','Ties go to next goal.'],
28:['Complete the mechanic on an unclaimed square, then claim it. First to 3 in a row wins.','There are no fixed turns. You may remove your own mistaken claim; the host may reroll an unclaimed square. Agree a draw if necessary.'],
29:['Each round uses one Hard mechanic. Secretly bid 1–5 attempts. Lowest bid tries first; equal bids are randomly ordered.','The FIRST successful player earns 1 mini-point and ends the round. Play 3 rounds. Equal final totals may tie.'],
30:['Lock your KPH guesses before the host reveals the actual shot speed. Misses count as 0 KPH.','Lowest total absolute guessing error wins. Follow the assigned shooters and guessers.'],
31:['Use the same random mechanic for four rungs: any goal → top half → top corner → crossbar down.','You get 2 attempts per rung. Highest completed rung wins; completing all four guarantees a share of first.'],
32:['Play the selected short events in order. Each event has its own rules and must settle its event placements.','The app adds event points. Equal final FFA totals share a place.'],
33:['Complete the displayed Easy → Medium → Hard mechanics, in that order, within 60 seconds.','Mark each completion. Rank by most completed, then fastest completion times, comparing the latest completed rung first.'],
34:['Privately view your number from 1–10. Bank it, or risk it for ONE new number that you must keep.','Everyone locks their decision before the reveal. Highest number wins; equal numbers share a place.'],
35:['Demo Royale: one life each. A demo eliminates you; eliminated players stay out.','Last surviving player or team wins. Report genuinely simultaneous eliminations together.'],
36:['Play on the randomly selected official arena shown here.','The host may reroll before starting if everyone agrees. Normal match scoring; next goal breaks ties.'],
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
47:['On your turn, say one valid Rocket League car that has not already been used. You have 10 seconds.','After you say it, YOU press “I said an unused answer” to immediately pass the turn; nobody else, including the host, can press it for you.','A duplicate, invalid answer, or timeout eliminates that player. The host only handles genuine disputes/invalid-answer corrections.'],
48:['On your turn, say one valid Rocket League pro, player, freestyler, or established creator that has not already been used. You have 10 seconds.','After you say it, YOU press “I said an unused answer” to immediately pass the turn; nobody else, including the host, can press it for you.','A duplicate, invalid answer, or timeout eliminates that player. The host only handles genuine disputes/invalid-answer corrections.'],
49:['The bomb moves continuously toward one side. Only the threatened side may answer with a valid unused Rocket League car name.','A correct answer reverses it from its current position. If it reaches your end, you lose.'],
50:['The bomb moves continuously toward one side. Only the threatened side may name a valid unused Rocket League player or creator.','A correct answer reverses it from its current position. If it reaches your end, you lose.'],
51:['Play Multiball: 2 balls for 1v1, 4 balls for 2v2.','First side to score 2 goals wins. Report goals manually.'],
52:['Play normal tic-tac-toe with the randomly assigned X/O and first turn.','Alternate claiming empty squares. Three in a row wins; a full board without a line is a draw.'],
53:['Play using the agreed Boomer Ball settings.','Normal match scoring; next goal breaks a tie.'],
54:['Everyone sets FOV to the minimum for the entire match.','Ties go to next goal while keeping minimum FOV.'],
55:['Aim for the displayed target from 1–150 KPH. Take one valid goal each; retry a miss.','Closest goal speed wins. Tied players get a fresh target and repeat until separated.'],
56:['Stand up while playing the match.','Keep standing through any next-goal overtime.'],
57:['Both opponents simultaneously call one mechanic or shot requirement each. Combine those two requirements, then race to score that shot.','A valid completion must satisfy every requirement. Report the winner after players verify it.'],
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
80:['Check your PRIVATE role. Non-imposters share a secret prompt; the imposter must blend in.','Take two rounds of shots as clues, discuss, then secretly vote. A tied vote gives another clue round. Catch the imposter and they get one exact prompt guess to steal the win.'],
81:['Check your PRIVATE role. Give one verbal clue each without revealing the secret word, then discuss and secretly vote.','A tied vote gives another clue round. If the imposter is caught, they get one exact word guess to steal the win.'],
82:['The solo boss secretly chooses 1 of 3 mechanics. The team picks a challenger, who gets 2 attempts. Failing both eliminates them.','Do not choose the same challenger twice in a row unless they are the only survivor. Boss wins by eliminating everyone; the team wins by surviving 4 rounds (duo) or 6 (trio).'],
83:['Play for 2 minutes. Solo scores by touching the opposite back wall; trio scores normal goals.','Pause the browser clock after each point and resume when reset. If tied, the next qualifying point wins.'],
84:['Solo sets a mechanic with one attempt. A miss automatically gives the team a survived round.','If solo succeeds, EVERY teammate gets one copy attempt. Any success survives the round; all failing gives solo the win. Team wins after 3 survived rounds (duo) or 4 (trio).'],
85:['Play the four-player bracket. Each matchup independently draws a Sprint event.','Semifinals may run together. After both finish, choose simultaneous or sequential final/third-place matches. Each matchup must have one winner.'],
86:['Play the four-player bracket. Each matchup independently draws a game from the approved roulette pool.','After both semifinals finish, play the final and third-place matches together or one at a time.'],
87:['Play the four-player bracket, choosing/randomizing each matchup’s Rocket League mode yourselves.','Use the browser to record bracket winners. Each match needs one winner; then play final and third place.']
}
const timedMatches=new Set([1,17,18,19,20,23,27,36,45,46,53,54,56,58])
export const needsBattleAudio = g => !!g && (['light','bomb','potato','names','reverseSpeed','gauntlet','timedGoals','hunt','endurance','pressure'].includes(g.engine) || Object.values(g.matches||{}).some(needsBattleAudio))
export function playerRules(g) {
 const key=g.challengeId.replace('challenge-',''),n=parseInt(key),asym=['1v2','1v3'].includes(g.format),team=g.format==='2v2',ffa=g.format.includes('1v1v1');
 let lines=[...(R[key]||['Follow the displayed Challenge controls and report outcomes from Rocket League.'])];let setup=[],browser=[];
 if(timedMatches.has(n)) setup.push(g.engine==='series'?'Play each displayed head-to-head segment for 1 minute; add goals across segments.':team?'Set a 3-minute match.':'Set a 2-minute match.');
 if(g.engine==='tournament'&&n!==85&&n!==86&&n!==87)setup.push('Play the semifinals, then the final and third-place match. Each matchup uses the 1v1 rules below.');
 if(asym&&timedMatches.has(n)&&g.engine!=='series')lines.push('Multiply the solo player’s goals by '+(g.format==='1v2'?2:3)+' before comparing scores.');
 if(n===1&&asym)lines.push('Do not chase demos.');
 if(n===2&&asym)lines=['Solo defends 3 valid attacks from EACH teammate.','Compare team goals against solo saves. Equal scores are a draw.'];
 if(n===4&&asym)lines=['Solo attacks each opposing defender 3 times.','Compare solo goals against combined defender saves. Equal scores are a draw.'];
 if(n===5&&asym)lines=['Solo attempts crossbar hits; each teammate attempts crossbar-in goals. Take 3 attempts each.','Compare solo hits against the team’s combined qualifying goals.'];
 if(n===6&&asym)lines[0]='Use the same mechanic. Solo gets '+(g.format==='1v2'?4:3)+' attempts; each teammate gets '+(g.format==='1v2'?2:1)+'. Compare solo successes against combined team successes.';
 if(n===11)lines=g.format==='1v1'?['Take one Kuxir pinch attempt each. If only one scores, they win.','If both miss, repeat. If both score, compare goal speed; tied speed repeats.']:['Take 3 Kuxir pinch attempts each. Add successful goal KPH; misses are 0.','Highest total wins; tied placements take one extra attempt.'];
 if([10,26].includes(n)&&asym)lines.push('Multiply solo’s total by '+(g.format==='1v2'?2:3)+' and compare against the team’s combined total.');
 if([10,22,26].includes(n)&&team)lines.push('Add teammates’ scores for the team total.');
 if(n===14)lines=[g.format==='1v1'?'First to 2 kickoff wins.':g.format==='1v1v1'?'Play 3 kickoffs for every pairing. Add each player’s wins; tied places replay.':team?'Each player faces both opponents once. Add team wins; repeat the set if tied.':g.format==='1v2'?'Solo plays 2 kickoffs against each teammate. A 2–2 total is a draw.':g.format==='1v3'?'Solo plays one kickoff against each teammate. Most wins takes the Challenge.':'Each bracket matchup plays up to 3 kickoffs; first to 2 wins.','Report each kickoff winner using the displayed pairing.'];
 if(n===15)lines.push(asym?'Time each player separately. Compare solo time with the average teammate time; lower wins.':team?'The first individual to finish wins for their whole team.':'Finish order determines placements.');
 if(n===16)setup=[asym?'Solo gets '+(g.format==='1v2'?2:3)+' minutes; each teammate gets 1 minute. Compare solo completed shots against the team sum.':'Use a 2-minute browser timer.'];
 if([16,31,34,43].includes(n)&&team)lines.push('Compare each team’s best individual result.'+(n===31?' Use the second teammate’s result if the best results tie.':''));
 if(n===23){
  if(g.format==='1v3')lines.push('Trio timing: GREEN 35% for 7.5–12s, YELLOW 45% for 7.5–12s, RED 20% for 3–4.5s.');
  else if(g.format==='1v2')lines.push('Duo timing: GREEN 50% for 9–15s, YELLOW 30% for 6–10.5s, RED 20% for 3–6s.');
  else lines.push('Light timing: GREEN 50% for 9–13.5s, YELLOW 30% for 6–9s, RED 20% for 3–4.5s.');
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
 else if(['manual','mechanic','draft','mode','arena','light','sprintJudge'].includes(g.engine))browser.push('Play the Rocket League portion using these rules, then use the on-screen result controls to confirm the outcome.');
 if(g.playerChosen)return {setup:['Choose the Rocket League mode yourselves.'],lines:['Agree the settings before starting. Play to one winner and report the result here.'],browser:['The browser only tracks the bracket/result; it does not choose or validate your Rocket League mode.']};
 return {setup,lines,browser};
}
