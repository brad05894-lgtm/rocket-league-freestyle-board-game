import { secretAction, SECRET_ENGINES } from './partyChallengeSecretEngine'
import { PARTY_CHALLENGES, CHALLENGE_BY_ID, FORMAT_SIZES, challengePool } from './partyChallengeCatalog'
import { PARTY_MECHANICS } from './partyMechanics'
export const CHALLENGE_REWARDS = { winner: 8, draw: 0 } // Per-person Battle rewards; ties are resolved in rewardDistribution.
export const MODES = ['Soccar','Hoops','Snow Day','Rumble','Dropshot','Heatseeker']
export const ARENAS = ['DFH Stadium','Mannfield','Champions Field','Beckwith Park','Utopia Coliseum','Neo Tokyo','Forbidden Temple','Farmstead']
export const TARGETS = ['Upper Half','Lower Half','Left Side','Right Side','Top-Left Corner','Top-Right Corner','Bottom-Left Corner','Bottom-Right Corner','Crossbar-In','Post-In']
export const REQUIREMENTS = ['No boost during shot','No boost after first touch','Exactly one bounce','No ground bounce after setup','Sidewall touch','Backboard touch','Crossbar-in','Post-in','Top half','Bottom half','Left side','Right side','Finish airborne','Touch ceiling during setup','Start from wall','Start from ground','Start from own half','At least 3 touches','Exactly 2 touches','Flip on final touch','Reach above crossbar height','First touch from wall','Sidewall bank','Score without car touching wall']
export const SPRINTS = ['Speed Sprint','Freestyle Sprint','Crossbar Sprint','Pinch Sprint','KPH Guess Sprint']
export const ROULETTE_IDS = [1,17,18,19,20,23,27,36,45,46,51,53,54,56,57,58,88,89,90,91].map(n=>'challenge-'+n)
export const CAR_NAMES = ['Octane','Fennec','Dominus','Breakout','Merc','Scarab','Nissan Skyline GT-R','Batmobile','Takumi','Dingo','Jäger','Mantis','Animus GP','Gizmo','Nimbus','Road Hog','Road Hog XL','Twinzer','Masamune','Dominus GT','Breakout Type-S']
export const PEOPLE = 'Zen|Vatira|M0nkey M00n|ExoTiiK|Seikoo|Rise|Joyo|ApparentlyJack|Firstkiller|BeastMode|Daniel|Atomic|Chicago|GarrettG|Squishy|jstn|Rizzo|Retals|AyyJayy|Arsenal|Chronic|Noly|Comm|LJ|Yanxnz|Lostt|Dralii|Alpha54|Kaydop|Fairy Peak|Scrub Killa|JKnaps|Turbopolsa|ViolentPanda|Deevo|MetsaNauris|Ahmad|oKhaliD|TRK511|nwpo|SunlessKhan|Lethamyr|Musty|Mertzy|JonSandman|Wayton Pilkin|Thanovic|CBell|SpookLuke|Chief Beef|Kevpert|Pulse Fire|Pulse Evample|Pulse Temple|Dark(?)|Forky|Jessie|JohnnyBoi_i'.split('|')
export const WORDS = [...CAR_NAMES,...PARTY_MECHANICS.map(m=>m.name),...MODES,...ARENAS,...PEOPLE,...'Air Roll|Boost|Demo|Bump|Kickoff|Save|Assist|Own Goal|Overtime|Rule One|Rotation|Back Post|Shadow Defense|Fake|Challenge|Fifty-Fifty|Open Net|Crossbar|Backboard|Sidewall|Corner|Midfield|Boost Pad|Supersonic|Alpha Boost|Goal Explosion|Rocket Pass|Blueprint|Champion|Grand Champion|Supersonic Legend'.split('|')].map((name,i)=>({id:'word-'+i,name}))
export const clone = x => JSON.parse(JSON.stringify(x))
const need = (condition,message='That action is not available now.') => { if(!condition) throw Error(message) }
const sum = a => a.reduce((x,y)=>x+y,0)
export function numeric(value,integer=false) { need(value!=='' && value!==null && value!==undefined,'Enter a number.'); const n=Number(value); need(Number.isFinite(n)&&n>=0&&(!integer||Number.isInteger(n)),'Enter a valid non-negative '+(integer?'whole number.':'number.')); return n }
export function seeded(seed) { let x=Number(seed)>>>0; return ()=>{x+=0x6D2B79F5;let t=Math.imul(x^x>>>15,1|x);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296} }
const pick = (a,r) => { need(a.length,'No eligible choices.');return a[Math.floor(r()*a.length)] }
export const shuffle = (a,r) => { a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a }
const mech = (r,d) => {const m=pick(PARTY_MECHANICS.filter(m=>!d||m.difficulty===d),r);return {id:m.id,name:m.name,difficulty:m.difficulty}}
const draft = r => ['Easy','Medium','Hard'].map(d=>mech(r,d))
const asymmetric = g => ['1v2','1v3'].includes(g.format)
const ffa = g => ['1v1v1','1v1v1v1'].includes(g.format)
export const sideOf = (g,id) => g.sides.findIndex(a=>a.includes(id))
export const timerElapsed = (t,now) => t ? Math.max(0,(t.pausedAt ?? now)-t.startedAt-(t.pauseTotal||0)) : 0
export const timerLeft = (t,now) => t?.duration == null ? Infinity : Math.max(0,t.duration-timerElapsed(t,now))
const timer = (now,duration=null) => ({startedAt:now+1500,duration,pauseTotal:0})
const active = g => g.order.filter(id=>!g.out?.includes(id))
const nOf = g => parseInt(CHALLENGE_BY_ID[g.challengeId]?.number||'0')
export function groupsBy(ids,values,lower=false) {const sorted=[...ids].sort((a,b)=>(values[b]-values[a])*(lower?-1:1));const out=[];for(const id of sorted){if(out.length && values[id]===values[out.at(-1)[0]])out.at(-1).push(id);else out.push([id])}return out}
const result = (g,placements,now) => {g.result={placements,revealAt:now+650};g.phase='result';delete g.timer}
const sideWin = (g,side,now) => result(g,side===-1?[g.ids]:[g.sides[side],...g.sides.filter((_,i)=>i!==side)],now)
const survivalResult = (g,now) => {const alive=active(g);if(g.sides.length===2 && !ffa(g)){const sides=new Set(alive.map(id=>sideOf(g,id)));if(sides.size<=1){sideWin(g,sides.size?[...sides][0]:-1,now);return true}}else if(alive.length<=1){result(g,[...(alive.length?[alive]:[]),...(g.eliminations||[]).slice().reverse()],now);return true}return false}
const eliminate = (g,ids,now) => {ids=ids.filter(id=>!g.out.includes(id));if(!ids.length)return;g.out.push(...ids);g.eliminations.push(ids);survivalResult(g,now)}
function sideScores(g,values,mode='sum') {return g.sides.map(ids=>mode==='max'?Math.max(...ids.map(id=>values[id]||0)):sum(ids.map(id=>values[id]||0))/(mode==='average'?ids.length:1))}
function settleScores(g,values,now,{lower=false,ties=true,mode='sum',weighted=false}={}) {
 if(ffa(g)){const groups=groupsBy(g.ids,values,lower);if(!ties&&groups.some(a=>a.length>1)){g.groups=groups;g.tieGroups=groups.filter(a=>a.length>1);g.phase='tiebreak';return}result(g,groups,now);return}
 const scores=sideScores(g,values,mode);if(weighted&&asymmetric(g))scores[0]*=g.sides[1].length;
 g.totals=scores;if(scores[0]===scores[1]){if(ties)sideWin(g,-1,now);else{g.tieGroups=[g.ids];g.phase='tiebreak'}}else sideWin(g,(scores[0]>scores[1])!==lower?0:1,now)
}
export function createBattle({ids,hostId,source,challengerId,opponentId,seed,now}) {
 need(ids.length>=2&&ids.length<=4,'Challenges need 2–4 players.');const r=seeded(seed);
 const b={version:0,id:'battle-'+now+'-'+seed,status:'active',source,hostId:['battle-space','challenge-glove'].includes(source)?challengerId:hostId,challengerId,opponentId:opponentId||'',allPlayers:true,participantIds:ids,name:'Selecting Challenge',stage:'format',createdAt:now,seed};
 if(['challenge-glove','battle-space'].includes(source)){b.chooseParticipants=true;b.availableIds=[...ids];b.stage='format'}
 else {b.format=pick(ids.length===2?['1v1']:ids.length===3?['1v2','1v1v1']:['1v3','2v2','1v1v1v1'],r);b.stage=ids.length===2?'draw':'formatReveal'}
 b.stage='intro';return b
}
export function createGame(challengeId,format,ids,r,now,options={}) {
 const c=CHALLENGE_BY_ID[challengeId];need(c&&(c.formats.includes(format)||options.sprintBase),'Unsupported Challenge format.');const order=shuffle(ids,r);
 const sides= options.sides || (format==='2v2'?[order.slice(0,2),order.slice(2)]:asymmetric({format})?[[order[0]],order.slice(1)]:format==='1v1'?order.map(id=>[id]):order.map(id=>[id]));
 const g={instanceId:'match-'+now+'-'+Math.floor(r()*2**32),challengeId,format,ids:[...ids],order,sides,engine:c.engine,phase:'ready',round:1,turn:0,scores:Object.fromEntries(ids.map(id=>[id,0])),out:[],eliminations:[],history:[],entries:{},revision:0};
 const n=nOf(g);
 if([7,8,9,11,12,13,14,63,74,75,84].includes(n))g.engine='manual';
 if(n===24||n===25)g.engine='possession';
 if(!options.sprintBase && format==='1v1v1v1' && c.tournament){g.engine='tournament';g.matches={a:createMatch(g,order.slice(0,2),r,now),b:createMatch(g,order.slice(2),r,now)};g.stage='semis';return g}
 if(g.engine==='potato'&&format==='1v1v1v1'){g.engine='potatoTournament';g.sides=[order.slice(0,2),order.slice(2)];g.stage='opening';g.matches={opening:createGame(challengeId,'2v2',order,r,now)};return g}
 if((c.tag&&asymmetric(g))||n===64||n===69){g.engine='series';g.seriesMode=[33,57,59,60].includes(n)?'wins':'goals';g.pairs=n===64?[[sides[0][0],sides[1][0]],[sides[0][1],sides[1][1]]]:sides[1].map(id=>[sides[0][0],id]);g.segment=0;g.segmentScores=[];if(n===33)g.draft=draft(r);if([33,59,60].includes(n)){g.matches={current:createGame(challengeId,'1v1',g.pairs[0],r,now)};if([59,60].includes(n))g.matches.current.lives=Object.fromEntries(g.pairs[0].map(id=>[id,1]))}}
 if([6,31,74,75].includes(n))g.mechanic=mech(r);
 if([22,33,78].includes(n))g.draft=draft(r);
 if(n===19)g.setting=pick(MODES,r);
 if(n===55)g.target=1+Math.floor(r()*150);
 if(n===65)g.displayTeams=[order.slice(0,2),order.slice(2)];
 if(n===31)g.ladders=Object.fromEntries(ids.map(id=>[id,{level:0,misses:0,done:false}]));
 
 if(['horse','chain','speedladder','reverseSpeed','names','survival'].includes(g.engine)){g.lives=Object.fromEntries(ids.map(id=>[id,[59,60].includes(n)?3:[7,9,41,42].includes(n)?2:1]));g.subphase='set';g.copies={};g.baseline=null}
 if(n===63){g.order=['team0','team1'];g.lives={team0:2,team1:2};g.subphase='set'}
 if(n===28||n===52){g.tiles=Array(9).fill('');if(n===28)g.tileMechanics=Array.from({length:9},()=>mech(r));g.marks={[order[0]]:'X',[order[1]]:'O'}}
 if(n===44){g.rope=0;g.limit=format==='1v1'?3:format==='1v2'?4:5;g.mechanics=Object.fromEntries(ids.map(id=>[id,mech(r)]))}
 if(n===49||n===50){g.bomb={position:0,direction:r()<.5?-1:1,at:now,version:0};g.phase='ready'}
 if(n===37)g.letter='';
 if(n===32){g.events=shuffle(SPRINTS,r).slice(0,format==='1v2'?2:3);g.eventIndex=0;g.eventResults=[];g.matches={current:triathlonEvent(g,r,now)}}
 if(n===14&&g.engine!=='manual'){g.pairs=ffa(g)?order.flatMap((a,i)=>order.slice(i+1).map(b=>[a,b])):format==='2v2'?sides[0].flatMap(a=>sides[1].map(b=>[a,b])):asymmetric(g)?sides[1].map(id=>[sides[0][0],id]):[order];g.pairIndex=0;g.pairWins=[];g.kickoffCount=0;g.kickoffLimit=ffa(g)?3:format==='1v2'?2:format==='2v2'||format==='1v3'?1:3}
 if(n===68)g.scores[sides[0][0]]=2;
 if(n===70){const d=r()<.5?['Medium','Easy']:['Hard','Medium'];g.combo=[Array.from({length:3},()=>mech(r,d[0])),Array.from({length:3},()=>mech(r,d[1]))];g.comboInputs={}}
 if(n===79){g.crossing=1;g.safe={};g.crossings=format==='1v2'?3:5}
 if(n===82){g.subphase='bossChoose';g.totalRounds=format==='1v2'?4:6;g.attempt=0}
 if(n===84){g.subphase='set';g.copies={};g.survived=0}
 if(n===29){g.mechanic=mech(r,'Hard');g.subphase='bid'}
 if([21,30,39,80,81,34].includes(n)){g.subphase=[80,81].includes(n)?'roles':n===34?'decide':n===21?'attack':'guess';g.shot=0;g.reveals={};g.commits={};if(asymmetric(g))g.captain=pick(sides[1],r)}
 if(n===30||n===39)g.shooters=asymmetric(g)?Array(3).fill(sides[0][0]):Array.from({length:n===39?(format==='1v1'?3:2):1},()=>order).flat();
 if(g.engine==='draft'){g.draftTimed=challengeId.toLowerCase()==='challenge-22b';g.attempt=0;g.draftCounts={};}
 if(g.engine==='possession'){g.possessionOrder=g.sides.map(side=>side[0]);g.possessionIndex=0;g.attempt=0;g.possessionRound=1;}
 if([59,60].includes(n)&&g.engine==='survival')g.lives=Object.fromEntries(ids.map(id=>[id,1]));
 if(g.engine==='bust'){g.bustTarget=200+Math.floor(r()*301);g.bustRemaining=g.bustTarget;g.bustHistory=[];}
 return g
}
function createMatch(parent,ids,r,now) {const n=nOf(parent);let cid=parent.challengeId;let sprint='';if(n===86)cid=pick(ROULETTE_IDS,r);if(n===85){sprint=pick(SPRINTS,r);cid='challenge-1'}if(n===87)cid='challenge-1';const g=createGame(cid,'1v1',ids,r,now);if(sprint)return createSprint(sprint,'1v1',ids,r,now);if(n===87){g.playerChosen=true;g.engine='manual'}if([28,52].includes(n))g.mustResolveWinner=true;return g}
function snapshot(g){const h=g.history||[];const saved=JSON.parse(JSON.stringify(g,(key,value)=>key==='history'?[]:value));g.history=[...h.slice(-29),saved]}
export function undoGame(g,now) {need(g.history?.length,'Nothing to undo.');const h=[...g.history];const restored=h.pop();for(const key of Object.keys(g))delete g[key];Object.assign(g,restored,{history:h});if(g.timer?.pausedAt==null&&g.timer)g.timer.pausedAt=now;if(g.engine==='bomb'&&Math.abs(bombPosition(g,now))>=1)sideWin(g,bombPosition(g,now)<0?1:0,now);g.revision++;}
function applyGameAction(g,a,uid,host,r,now) {
 need(g.ids.includes(uid)||host,'You are not in this match.');const n=nOf(g),own=a.playerId||uid;g.entries||={};g.history||=[];g.out||=[];g.eliminations||=[];g.copies||={};g.roundInputs||={};g.comboInputs||={};g.safe||={};g.commits||={};g.reveals||={};g.segmentScores||=[];g.eventResults||=[];g.tiles=Array.from({length:9},(_,i)=>g.tiles?.[i]||'');const admin=()=>need(host,'Only the Battle Host can do this.');const person=id=>need(uid===id,'Only that player can submit their own input.');const current=()=>active(g)[g.turn%Math.max(1,active(g).length)];
 if(a.type==='reopenMatch'){admin();need(g.matches?.[a.matchId]?.result,'That match has no result.');delete g.result;g.phase='active';const m=g.matches[a.matchId];delete m.result;m.phase='active';if(['a','b'].includes(a.matchId))g.stage='semis';else g.stage='placements';return}
 if(a.type==='undo'){admin();need(!SECRET_ENGINES.includes(g.engine),'Use a confirmed full restart after secret information has been dealt.');undoGame(g,now);return}
 if(a.type==='tiebreak'){admin();startTiebreak(g,r);return}
 if(a.type==='restart'){admin();need(a.confirmed,'Confirm restart.');const fresh=g.sprint?createSprint(g.sprint,g.format,g.ids,r,now,{sides:g.sides}):createGame(g.challengeId,g.format,g.ids,r,now);for(const key of Object.keys(g))delete g[key];Object.assign(g,fresh);return}
 if(a.type==='correct'){admin();need(g.result,'No result to correct.');delete g.result;g.phase='active';return}
 if(a.type==='manualResult'){admin();need(['active','overtime','result'].includes(g.phase),'Read the rules and start first.');const groups=a.placements;need(Array.isArray(groups)&&groups.length&&groups.every(x=>Array.isArray(x)&&x.length),'Enter placements.');const flat=groups.flat();need(flat.length===g.ids.length&&new Set(flat).size===g.ids.length&&flat.every(id=>g.ids.includes(id)),'Every player needs one placement.');need(['manual','mechanic','draft','mode','arena','light','pressure','sprintJudge'].includes(g.engine)||a.override===true,'Use the Challenge controls, or confirm a correction.');if(ffa(g)&&a.override!==true)need(groups.every(group=>group.length===1)||drawAllowed(g),'Resolve tied placements using the Challenge rules first.');if(groups.length===1)need(drawAllowed(g)||a.override===true,'This Challenge requires a winner.');snapshot(g);result(g,groups,now);return}
 need(!g.result,'Correct the result before changing this Challenge.');if(a.type!=='matchAction')snapshot(g);g.revision++;
 if(a.type==='start'){admin();need(g.phase==='ready','Already started.');g.phase='active';if(['names','bomb','light','timedGoals','hunt','endurance','bust'].includes(g.engine)){const seconds=n===71?8:[66,67,68].includes(n)?60:180;g.timer=timer(now,g.engine==='bust'?60000:['names'].includes(g.engine)?10000:n===72||n===76||n===77||n===83||n===16?120000:seconds*1000);if(g.engine==='bomb'){g.bomb.at=g.timer.startedAt;g.timer.duration=null};if(n===71)g.subphase='headstart';if(g.engine==='endurance'&&asymmetric(g))delete g.timer;if(g.engine==='light'){g.lightSeed=Math.floor(r()*2**32);g.timer.duration=null}}return}
 if(a.type==='pause'){admin();need(g.timer&&!g.timer.pausedAt);if(g.engine==='bomb')g.bomb={...g.bomb,position:bombPosition(g,now),at:now};g.timer.pausedAt=now;return}
 if(a.type==='resume'){admin();need(g.timer?.pausedAt);g.timer.pauseTotal+=(now-g.timer.pausedAt);delete g.timer.pausedAt;if(g.engine==='bomb')g.bomb.at=now;return}
 if(a.type==='timerStart'){need(g.phase==='active'||g.phase==='ready');const id=current();if(g.engine==='pressure')need(g.sides[g.turn%2].includes(uid)||host);else if(g.engine==='airdribble'){need(uid!==id&&g.ids.includes(uid),'Another player must operate the timer.');g.operator=uid}else person(id);need(g.engine==='pressure'?(!g.timer||timerLeft(g.timer,now)===0):!g.timer,'Submit or redo the existing run first.');const duration=g.engine==='pressure'?numeric(a.seconds)*1000:g.engine==='endurance'?(sideOf(g,id)===0?g.sides[1].length:1)*60000:g.engine==='reverseSpeed'||g.engine==='gauntlet'?60000:null;if(g.engine==='pressure')need([5000,10000,15000].includes(duration));g.timer=timer(now,duration);g.phase='active';return}
 if(a.type==='timerStop'){if(g.engine==='airdribble')person(g.operator);else person(current());need(g.timer&&!g.timer.pausedAt&&now>=g.timer.startedAt,'Start the timer first.');need(timerLeft(g.timer,now)>0,'Time has expired.');g.timer.pausedAt=now;return}
 if(a.type==='redoRun'){person(g.engine==='airdribble'?g.operator:current());delete g.timer;delete g.entries[current()];if(g.laps)delete g.laps[current()];return}
 if(a.type==='reroll'){admin();need(g.engine!=='arena','The selected arena is locked.');need(a.confirmed,'Confirm the agreed reroll.');if(g.engine==='mechanic'||g.engine==='heads'||g.engine==='manual'&&[74,75].includes(n))g.mechanic=mech(r);else if(g.engine==='draft')g.draft=draft(r);else if(g.engine==='alphabet')g.letter=pick([...new Set(PARTY_MECHANICS.map(m=>m.name[0].toUpperCase()))],r);else if(g.engine==='mode'||g.engine==='arena'){need(g.phase==='ready');g.setting=pick(g.engine==='mode'?MODES:ARENAS,r)}else throw Error('Use a full restart for this Challenge.');return}
 need(['active','overtime','tiebreak','regroup'].includes(g.phase),'Start the Challenge first.');
 if(g.engine==='tournament'||g.engine==='potatoTournament'){handleTournament(g,a,uid,host,r,now);return}
 if(SECRET_ENGINES.includes(g.engine)){secretAction(g,a,uid,host,r,now);return}
 if(a.type==='tick'){need(host||g.ids.includes(uid));tick(g,now,r);return}
 if(g.engine==='sprintScore'){person(own);const eligible=ffa(g)?g.tieGroups?.flat()||g.sprintSubmitters:g.sprintSubmitters;need(eligible.includes(own),'Your placement is already settled.');const count=g.tieGroups?1:g.sprintAttempts;g.entries[own]||=[];need(g.entries[own].length<count);const value=numeric(a.value);if(g.sprint==='Crossbar Sprint')need(value===0||value===1);g.entries[own].push(value);if(eligible.every(id=>g.entries[id]?.length===count)){const values=Object.fromEntries(g.ids.map(id=>[id,sum(g.entries[g.sprint==='Pinch Sprint'&&g.format==='2v2'?g.sides[sideOf(g,id)][0]:id]||[])]));finishSprintScores(g,values,now);}return}
 if(g.engine==='numeric'){if(n===11&&g.format==='1v1'){kuxirDuel(g,a,uid,host,now);return}person(own);need(g.ids.includes(own));const eligible=g.tieGroups?g.tieGroups.flat():g.ids;need(eligible.includes(own),'Your placement is already settled.');const count=g.tieGroups?1:([55,65].includes(n)||n===11&&g.format==='1v1'?1:3);const key=[61,62].includes(n)?g.sides[sideOf(g,own)][0]:own;
 if([61,62].includes(n)){const seq=g.order.filter(id=>g.sides.some(s=>s[0]===id));const total=Object.values(g.entries).flat().length;need(key===seq[total%2],'Wait for the other team attempt.')}
 g.entries[key]||=[];need(g.entries[key].length<count,'All attempts are submitted.');g.entries[key].push(numeric(a.value,n===65));const targets=[61,62].includes(n)?g.sides.map(s=>s[0]):eligible;
 if(targets.every(id=>(g.entries[id]?.length||0)===count))finishNumeric(g,now);return}
 if(g.engine==='ladder'){person(own);const l=g.ladders[own];need(l&&!l.done);if(a.type==='made'){l.level++;l.misses=0;if(n===31&&l.level===4)l.done=true}else if(a.type==='miss'){l.misses++;if(l.misses===(n===12?3:2))l.done=true}else throw Error('Invalid attempt.');if(Object.values(g.ladders).every(v=>v.done)){const values=Object.fromEntries(g.ids.map(id=>[id,g.ladders[id].level]));if(n===31&&g.format==='2v2'){const s=g.sides.map(ids=>ids.map(id=>values[id]).sort((a,b)=>b-a));sideWin(g,s[0][0]===s[1][0]?(s[0][1]===s[1][1]?-1:s[0][1]>s[1][1]?0:1):s[0][0]>s[1][0]?0:1,now)}else settleScores(g,values,now,{mode:'max'})}return}
 if(g.engine==='reset2'){person(own);need(active(g).includes(own)&&g.roundInputs[own]===undefined);g.roundInputs[own]=a.type==='made';if(active(g).every(id=>g.roundInputs[id]!==undefined)){const alive=active(g),made=alive.filter(id=>g.roundInputs[id]);if(made.length){eliminate(g,alive.filter(id=>!g.roundInputs[id]),now);g.level++}g.roundInputs={};g.round++}return}
 if(g.engine==='survival'&&a.type==='batchLife'){need(a.ids?.length===1&&a.ids[0]===uid,'Players report only their own elimination.');need(Array.isArray(a.ids)&&a.ids.length&&new Set(a.ids).size===a.ids.length&&a.ids.every(id=>active(g).includes(id)));for(const id of a.ids)g.lives[id]--;eliminate(g,a.ids.filter(id=>!g.lives[id]),now);return}
 if(g.engine==='survival'){person(own);need(active(g).includes(own));g.lives[own]--;if(!g.lives[own])eliminate(g,[own],now);return}
 if(g.engine==='horse'||g.engine==='chain'||g.engine==='copySurvival'){admin();horseAction(g,a,now);return}
 if(g.engine==='ttt'){const i=numeric(a.tile,true);need(i<9);if(a.type==='rerollTile'){admin();need(n===28&&!g.tiles[i]);g.tileMechanics[i]=mech(r);return}need(g.ids.includes(uid));if(n===52)need(uid===g.order[g.turn%2],'Wait for your turn.');if(g.tiles[i]){need(n===28&&g.tiles[i]===uid);g.tiles[i]='';return}need(a.type==='claim');g.tiles[i]=uid;g.turn++;const line=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(l=>l.every(j=>g.tiles[j]===uid));if(line){g.winLine=line;sideWin(g,sideOf(g,uid),now)}else if(g.tiles.every(Boolean)){if(g.mustResolveWinner){g.round=(g.round||1)+1;g.tiles=Array(9).fill('');delete g.winLine;if(n===28)g.tileMechanics=Array.from({length:9},()=>mech(r));g.turn=g.round%2}else sideWin(g,-1,now)}return}
 if(g.engine==='tug'){need(g.ids.includes(uid));need(a.revision===g.mechanicVersions?.[uid]||(!g.mechanicVersions?.[uid]&&a.revision===0),'That mechanic was already submitted.');const side=sideOf(g,uid);const amount=a.type==='rerollOwn'?-1:asymmetric(g)&&side===0?g.sides[1].length:1;g.rope=Math.max(-g.limit,Math.min(g.limit,g.rope+(side===0?-1:1)*amount));g.mechanics[uid]=mech(r);g.mechanicVersions||={};g.mechanicVersions[uid]=(g.mechanicVersions[uid]||0)+1;if(Math.abs(g.rope)===g.limit)sideWin(g,g.rope<0?0:1,now);return}
 if(g.engine==='bomb'){need(a.type==='reverse');need(a.revision===g.bomb.version,'Another answer already reversed the bomb.');const p=bombPosition(g,now);need(Math.abs(p)<1,'The bomb already reached the endpoint.');need(sideOf(g,uid)===(g.bomb.direction<0?0:1),'Only the targeted side can answer.');g.bomb={position:p,direction:-g.bomb.direction,at:now,version:g.bomb.version+1};return}
 if(g.engine==='alphabet'){if(a.type==='chooseLetter'){admin();need(!g.letter);g.letter=pick([...new Set(PARTY_MECHANICS.map(m=>m.name[0].toUpperCase()))],r);return}person(own);need(g.letter&&g.ids.includes(own));g.scores[own]++;if(g.scores[own]>=3)settleScores(g,g.scores,now,{mode:'max'});else g.letter='';return}
 if(g.engine==='speedladder'){person(current());if(g.subphase==='set'){need(a.type==='baseline');g.subphase='beat';g.turn=(g.turn+1)%active(g).length}else if(a.type==='higher')g.turn=(g.turn+1)%active(g).length;else{const id=current();g.lives[id]--;g.subphase='set';if(!g.lives[id]){eliminate(g,[id],now);g.order=shuffle(active(g),r);g.turn=0}}return}
 if(g.engine==='reverseSpeed'){person(current());need(g.timer?.pausedAt,'Press Goal Scored before entering KPH.');const value=numeric(a.value),id=current(),alive=active(g),index=alive.indexOf(id);if(value===0){eliminate(g,[alive[(index+1)%alive.length]],now);g.baseline=null}else if(g.baseline!==null&&value>g.baseline){g.lives[id]--;if(!g.lives[id])eliminate(g,[id],now)}else g.baseline=value;const next=alive.slice(index+1).concat(alive.slice(0,index+1)).find(x=>!g.out.includes(x));g.turn=active(g).indexOf(next);delete g.timer;return}
 if(g.engine==='bust'){const aliveNow=active(g),id=current();person(id);need(a.type==='bustKph','Enter the KPH from your scored goal.');need(g.timer&&!g.timer.pausedAt&&now>=g.timer.startedAt&&timerLeft(g.timer,now)>0,'Your 1-minute turn is not active.');const value=numeric(a.value),before=Number(g.bustRemaining)||0,after=before-value;g.bustHistory||=[];g.bustHistory.push({playerId:id,value,before,after,round:g.round});if(after<0){eliminate(g,[id],now);if(!g.result)resetBustRound(g,r,now);return}if(after===0){const aliveBefore=[...aliveNow],idx=aliveBefore.indexOf(id),victim=aliveBefore[(idx+1)%aliveBefore.length];if(victim&&victim!==id)eliminate(g,[victim],now);if(!g.result)resetBustRound(g,r,now);return}g.bustRemaining=after;g.turn=(g.turn+1)%active(g).length;g.timer=timer(now,60000);return}
 if(g.engine==='names'&&a.type==='invalidAnswer'){throw Error('Try a different answer before your timer expires.')}
 if(g.engine==='names'&&a.type==='redoLastPass'){admin();need(g.lastPass,'Only the immediately previous submitted turn can be redone.');need(active(g).includes(g.lastPass.playerId),'That player is no longer active.');g.turn=active(g).indexOf(g.lastPass.playerId);g.timer={startedAt:now+500,duration:Math.max(1,Number(g.lastPass.remainingMs)||1),pauseTotal:0};g.redoNotice={playerId:g.lastPass.playerId,remainingMs:g.timer.duration};delete g.lastPass;return}
 if(g.engine==='names'){need(uid===current(),'Wait for your turn.');need(a.type==='pass'&&timerLeft(g.timer,now)>0);const remainingMs=timerLeft(g.timer,now);g.lastPlayer=current();g.lastPass={playerId:current(),turn:g.turn,remainingMs,submittedAt:now};delete g.redoNotice;g.turn=(g.turn+1)%active(g).length;g.timer={startedAt:now,duration:10000,pauseTotal:0};return}
 if(g.engine==='series'){
 if(g.matches?.current){
   if(a.type==='matchAction'){need(a.matchId==='current');gameAction(g.matches.current,a.action,uid,host,r,now);return}
   admin();need(a.type==='nextSegment'&&g.matches.current.result,'Finish the mini-match first.');const groups=g.matches.current.result.placements;if(groups.length===1){g.matches.current=createGame(g.challengeId,'1v1',g.pairs[g.segment],r,now);g.tieNotice={message:'The mini-match is tied. Replay this matchup before advancing the series.'};return}const winner=groups[0][0];seriesAction(g,{side:sideOf(g,winner)},r,now);if(!g.result){const pair=g.overtime?g.tiebreakPair:g.pairs[g.segment];g.matches.current=createGame(g.challengeId,'1v1',pair,r,now);if([59,60].includes(n))g.matches.current.lives=Object.fromEntries(pair.map(id=>[id,1]));}return
 }
 if(g.seriesMode==='goals'&&!g.overtime){const pair=g.pairs[g.segment];need(pair.includes(uid),'Wait for your matchup.');g.seriesInputs||={};need(g.seriesInputs[uid]===undefined,'Your goals are locked.');g.seriesInputs[uid]=numeric(a.value,true);if(pair.every(id=>g.seriesInputs[id]!==undefined)){seriesAction(g,{left:g.seriesInputs[pair[0]],right:g.seriesInputs[pair[1]]},r,now);g.seriesInputs={}}return}
 admin();seriesAction(g,a,r,now);return}

 if(g.engine==='triathlon'){
 if(a.type==='matchAction'){need(a.matchId==='current');gameAction(g.matches.current,a.action,uid,host,r,now);return}
 admin();need(a.type==='nextEvent'&&g.matches.current.result,'Finish the event first.');const groups=g.matches.current.result.placements;need(groups.length>1,'Resolve the event tie first.');g.eventResults.push(groups);
 if(ffa(g))groups.forEach((ids,i)=>ids.forEach(id=>g.scores[id]+=g.ids.length-i));else{const side=sideOf(g,groups[0][0]);g.scores[g.sides[side][0]]++}
 g.eventIndex++;if(g.eventIndex>=g.events.length){settleScores(g,g.scores,now,{ties:!asymmetric(g)});if(g.phase==='tiebreak'){g.events.push(pick(SPRINTS,r));g.tiebreakOpponent=pick(g.sides[1],r);g.phase='active'}}
 if(!g.result)g.matches.current=triathlonEvent(g,r,now);return}
 if(g.engine==='kickoff'){admin();const pair=g.pairs[g.pairIndex];need(pair.includes(own));g.scores[own]++;g.kickoffCount++;
 if(g.format==='1v1'&&g.scores[own]===2){sideWin(g,sideOf(g,own),now);return}
 if(g.kickoffCount>=g.kickoffLimit){g.kickoffCount=0;g.pairIndex++;
 if(g.pairIndex>=g.pairs.length){
 if(ffa(g)&&g.groups){const eligible=new Set(g.pairs.flat());g.groups=g.groups.flatMap(group=>group.length>1&&group.every(id=>eligible.has(id))?groupsBy(group,g.scores):[group]);g.tieGroups=g.groups.filter(group=>group.length>1);if(g.tieGroups.length)g.phase='tiebreak';else result(g,g.groups,now)}
 else settleScores(g,g.scores,now,{ties:g.format==='1v2'});
 if(g.phase==='tiebreak'){g.round++;g.phase='active';g.pairIndex=0;g.scores=Object.fromEntries(g.ids.map(id=>[id,0]));if(ffa(g)){const tied=g.tieGroups[0];g.pairs=tied.flatMap((a,i)=>tied.slice(i+1).map(b=>[a,b]));g.kickoffLimit=1}}}}return}
 if(g.engine==='sprint'&&!asymmetric(g)){person(own);need(g.entries[own]===undefined);g.entries[own]=now;if(g.format==='2v2'||g.format==='1v1')sideWin(g,sideOf(g,own),now);else if(g.ids.every(id=>g.entries[id]!==undefined))settleScores(g,g.entries,now,{lower:true});return}
 if(g.engine==='airdribble'||g.engine==='sprint'){if(g.engine==='airdribble')person(g.operator);else person(current());need(g.timer?.pausedAt,'Stop timer before submitting.');g.entries[current()]=a.failed?0:timerElapsed(g.timer,now);g.turn++;delete g.timer;if(g.turn>=g.order.length){if(g.engine==='airdribble'&&ffa(g)&&g.groups){g.groups=g.groups.flatMap(group=>group.length>1?groupsBy(group,g.entries):[group]);g.tieGroups=g.groups.filter(group=>group.length>1);if(!g.tieGroups.length){result(g,g.groups,now);return}g.phase='tiebreak'}else settleScores(g,g.entries,now,{lower:g.engine==='sprint',mode:g.engine==='sprint'?'average':g.format==='2v2'?'max':'sum',weighted:g.engine==='airdribble',ties:g.engine==='sprint'});if(g.phase==='tiebreak'){g.order=g.tieGroups.flat();g.turn=0;g.entries={};g.phase='active'}}return}
 if(g.engine==='gauntlet'){person(current());need(g.timer&&timerLeft(g.timer,now)>0&&now>=g.timer.startedAt);g.laps||={};g.laps[current()]||=[];g.laps[current()].push(timerElapsed(g.timer,now));if(g.laps[current()].length===3)nextGauntlet(g,now);return}
 if(g.engine==='endurance'){person(own);need(g.entries[own]===undefined,'Your result is already submitted.');need(g.timer&&timerLeft(g.timer,now)===0,'Wait for the timer.');if(asymmetric(g))need(own===current(),'Wait for your run.');g.entries[own]=numeric(a.value,true);if(asymmetric(g)){g.turn++;delete g.timer;}if(g.ids.every(id=>g.entries[id]!==undefined))settleScores(g,g.entries,now,{mode:g.format==='2v2'?'max':'sum'});return}
 if(g.engine==='goals'||g.engine==='timedGoals'||g.engine==='hunt'){if(g.engine==='hunt')person(n===71?g.sides[0][0]:a.playerId);else need(g.sides[a.side]?.includes(uid),'Only the scoring side may report this point.');timedAction(g,a,now);return}
 if(g.engine==='pressure'){need(host||g.sides[g.turn%2].includes(uid));need(a.type==='endTurn'&&a.confirmed,'Confirm all three durations are complete.');g.turn++;delete g.timer;if(g.turn>=2)g.normalAttacksDone=true;return}
 if(g.engine==='heads'){admin();g.entries[a.side]=a.made;need([0,1].includes(a.side));if(g.entries[0]!==undefined&&g.entries[1]!==undefined){if(g.entries[0]!==g.entries[1])sideWin(g,g.entries[0]?0:1,now);else{g.round++;g.entries={};g.mechanic=mech(r)}}return}
 if(g.engine==='combo'){person(own);const side=sideOf(g,own),i=numeric(a.index,true);need(i<3&&!Object.hasOwn(g.comboInputs,own+'_'+i));g.comboInputs[own+'_'+i]=a.made===true;if(g.ids.every(id=>[0,1,2].every(j=>Object.hasOwn(g.comboInputs,id+'_'+j)))){const scores=g.sides.map(ids=>[0,1,2].filter(j=>ids.every(id=>g.comboInputs[id+'_'+j])).length);g.totals=scores;if(scores[0]===scores[1]){g.round++;g.comboInputs={}}else sideWin(g,scores[0]>scores[1]?0:1,now)}return}
 if(g.engine==='relay'){need(g.ids.includes(uid));if(sideOf(g,uid)===0)sideWin(g,0,now);else{need(uid===g.sides[1][g.turn]);g.turn++;if(g.turn===3)sideWin(g,1,now)}return}
 if(g.engine==='shark'){if(a.type==='nextCrossing'){admin();need(g.phase==='regroup');g.phase='active';return}person(own);need(g.sides[1].includes(own)&&!g.out.includes(own));if(a.type==='safe')g.safe[own]=true;else if(a.type==='eliminate')g.out.push(own);else throw Error('Invalid crossing action.');const alive=g.sides[1].filter(id=>!g.out.includes(id));if(!alive.length)sideWin(g,0,now);else if(alive.every(id=>g.safe[id])){if(g.crossing===g.crossings)sideWin(g,1,now);else{g.crossing++;g.safe={};g.phase='regroup'}}return}
 throw Error('This action needs the dedicated Challenge controls.')
}
export function drawAllowed(g){const n=nOf(g);return [12,13,16,29,31,34,35,38,39,52].includes(n)||[2,4,15].includes(n)&&asymmetric(g)||n===14&&g.format==='1v2'||n===28}
function validateGroups(g,groups,ties=true){need(Array.isArray(groups)&&groups.every(a=>Array.isArray(a)&&a.length));const all=groups.flat();need(all.length===g.ids.length&&new Set(all).size===g.ids.length&&all.every(id=>g.ids.includes(id)));if(!ties&&ffa(g))need(groups.every(a=>a.length===1),'Resolve event ties first.')}
function finishNumeric(g,now){const n=nOf(g);
 if(n===55&&g.format==='1v1'){
  const errors=g.ids.map(id=>Math.abs(g.entries[id][0]-g.target));g.roundWins||=Object.fromEntries(g.ids.map(id=>[id,0]));
  if(errors[0]===errors[1]){g.phase='tiebreak';g.tieGroups=[g.ids];return}
  const winner=g.ids[errors[0]<errors[1]?0:1];g.roundWins[winner]++;
  if(g.roundWins[winner]>=2){sideWin(g,sideOf(g,winner),now);return}
  g.phase='round-summary';g.roundWinner=winner;return
 }
let values=Object.fromEntries(g.ids.map(id=>[id,n===55?Math.abs((g.entries[id]?.[0]??g.target)-g.target):sum(g.entries[id]||[])]));if([61,62].includes(n)){values=Object.fromEntries(g.ids.map(id=>{const arr=g.entries[g.sides[sideOf(g,id)][0]];return [id,n===61?Math.max(...arr):sum(arr)]}))}
 if(g.groups&&ffa(g)){let groups=[];for(const group of g.groups)groups.push(...(group.length>1?groupsBy(group,values,n===55):[group]));g.groups=groups;g.tieGroups=groups.filter(a=>a.length>1);if(!g.tieGroups.length){result(g,groups,now);return}g.phase='tiebreak';return}
 settleScores(g,values,now,{lower:n===55,ties:n===65,mode:n===55&&asymmetric(g)?'average':[61,62].includes(n)?'max':'sum',weighted:[10,26].includes(n)});
}
export function startTiebreak(g,r){need(g.phase==='tiebreak');g.entries={};g.round++;g.phase='active';if(nOf(g)===55)g.target=1+Math.floor(r()*150)}
function horseAction(g,a,now){const n=nOf(g);let alive=n===63?g.order:active(g);const setter=alive[g.turn%alive.length];
 if(g.engine==='copySurvival'){if(g.subphase==='set'){if(a.type==='miss'){g.survived++;if(g.survived===(g.format==='1v2'?3:4))sideWin(g,1,now)}else{g.subphase='copy';g.copies={}}}else{need(g.sides[1].includes(a.playerId));g.copies[a.playerId]=a.type==='made';if(g.sides[1].every(id=>g.copies[id]!==undefined)){if(Object.values(g.copies).some(Boolean)){g.survived++;if(g.survived===(g.format==='1v2'?3:4))sideWin(g,1,now);else{g.subphase='set';g.copies={}}}else sideWin(g,0,now)}}return}
 if(g.engine==='chain'){if(g.subphase==='set'){if(a.type==='made')g.subphase='copy';else g.turn=1-g.turn}else if(g.subphase==='copy'){if(a.type==='miss')sideWin(g,sideOf(g,setter),now);else{g.turn=1-g.turn;g.subphase='upgrade'}}else if(a.type==='made')g.subphase='copy';else{g.subphase='set';g.turn=1-g.turn}return}
 if(g.subphase==='set'){if(a.type==='miss'){g.turn=(g.turn+1)%alive.length;return}g.subphase='copy';g.required=alive.filter(id=>id!==setter&&(n===63||g.format!=='2v2'||sideOf(g,id)!==sideOf(g,setter)));g.copies={};return}
 need(g.required.includes(a.playerId)&&g.copies[a.playerId]===undefined);g.copies[a.playerId]=a.type==='made';if(!g.required.every(id=>g.copies[id]!==undefined))return;
 const outs=[];for(const id of g.required)if(!g.copies[id]){g.lives[id]--;if(!g.lives[id])outs.push(id)}
 if(n===63){if(outs.length)sideWin(g,outs[0]==='team0'?1:0,now)}else eliminate(g,outs,now);
 if(!g.result){const oldIndex=alive.indexOf(setter);const next=alive.slice(oldIndex+1).concat(alive.slice(0,oldIndex+1)).find(id=>!g.out.includes(id));g.turn=(n===63?g.order:active(g)).indexOf(next);g.subphase='set';g.copies={}}
}
function seriesAction(g,a,r,now){const n=nOf(g);if(g.overtime){need([0,1].includes(a.side));sideWin(g,a.side,now);return}const pair=g.pairs[g.segment];need(pair);let scores;if(g.seriesMode==='wins'){need([0,1].includes(a.side));scores=a.side===0?[1,0]:[0,1]}else scores=[numeric(a.left,true),numeric(a.right,true)];g.segmentScores[g.segment]=scores;g.segment++;g.totals=[sum(g.segmentScores.map(s=>s[0])),sum(g.segmentScores.map(s=>s[1]))];if(g.segment<g.pairs.length){if(n===33)g.draft=draft(r);return}if(g.totals[0]!==g.totals[1])sideWin(g,g.totals[0]>g.totals[1]?0:1,now);else{g.overtime=true;g.tiebreakPair=[g.pairs.at(-1)[0],[64,69].includes(n)?g.pairs.at(-1)[1]:pick(g.sides[1],r)]}}
function handleTournament(g,a,uid,host,r,now){if(g.engine==='potatoTournament'&&g.stage==='opening'){need(a.type==='matchAction'&&a.matchId==='opening');gameAction(g.matches.opening,a.action,uid,host,r,now);if(g.matches.opening.result){const groups=g.matches.opening.result.placements;g.matches.final=createGame(g.challengeId,'1v1',groups[0],r,now);g.matches.third=createGame(g.challengeId,'1v1',groups[1],r,now);g.stage='placementChoice'}return}
 if(a.type==='placementMode'){need(host);need(g.stage==='placementChoice');need(['both','final','third'].includes(a.mode));g.playMode=a.mode;g.stage='placements';return}
 if(a.type==='matchAction'){const m=g.matches[a.matchId];need(m,'Unknown match.');if(g.stage==='semis')need(['a','b'].includes(a.matchId));else{need(g.stage==='placements');if(g.playMode!=='both'){const first=g.matches[g.playMode];need(a.matchId===g.playMode||first.result,'That match is waiting.')}}
 gameAction(m,a.action,uid,host,r,now);
 if(g.stage==='semis'&&g.matches.a.result&&g.matches.b.result){const a1=g.matches.a.result.placements,b1=g.matches.b.result.placements;need(a1[0].length===1&&b1[0].length===1,'Semifinals need one winner.');g.matches.final=placementMatch(g,g.matches.final,[a1[0][0],b1[0][0]],r,now);g.matches.third=placementMatch(g,g.matches.third,[a1[1][0],b1[1][0]],r,now);g.stage='placementChoice'}
 if(g.stage==='placements'&&g.matches.final.result&&g.matches.third.result)result(g,[...g.matches.final.result.placements,...g.matches.third.result.placements],now);return}
 throw Error('Choose a match action.')}
export function bombPosition(g,now){if(!g.bomb)return 0;const end=g.timer?.pausedAt??now;return Math.max(-1,Math.min(1,g.bomb.position+g.bomb.direction*Math.max(0,end-g.bomb.at)/10000))}
export function lightAt(g,now){const elapsed=timerElapsed(g.timer,now);const r=seeded(g.lightSeed);let at=0,color='green',index=0;while(at<=elapsed&&index<50000){const v=r(),trio=g.format==='1v3',duo=g.format==='1v2';const greenCut=trio?.30:.42,yellowCut=trio?.77:.78;color=v<greenCut?'green':v<yellowCut?'yellow':'red';const range=trio?(color==='green'?[7.5,12]:color==='yellow'?[8.5,13]:[3,4.5]):duo?(color==='green'?[9,15]:color==='yellow'?[7.5,12]:[3,6]):(color==='green'?[9,13.5]:color==='yellow'?[7.5,11.5]:[3,4.5]);at+=(range[0]+r()*(range[1]-range[0]))*1000;index++}return {color,index}}
function nextGauntlet(g,now){g.turn++;delete g.timer;if(g.turn>=g.ids.length){const compare=(a,b)=>{const x=g.laps?.[a]||[],y=g.laps?.[b]||[];if(x.length!==y.length)return y.length-x.length;for(let i=x.length-1;i>=0;i--)if(x[i]!==y[i])return x[i]-y[i];return 0};const ids=[...g.ids].sort(compare),groups=[];for(const id of ids){if(groups.length&&!compare(id,groups.at(-1)[0]))groups.at(-1).push(id);else groups.push([id])}result(g,groups,now)}}
function resetBustRound(g,r,now){if(survivalResult(g,now))return;const alive=active(g);g.round=(g.round||1)+1;g.bustTarget=200+Math.floor(r()*301);g.bustRemaining=g.bustTarget;g.order=shuffle(alive,r);g.turn=0;g.timer=timer(now,60000)}
function tick(g,now,r){if(g.phase!=='active')return;const n=nOf(g);if(g.engine==='bomb'){const pos=bombPosition(g,now);if(Math.abs(pos)>=1)sideWin(g,pos<0?1:0,now);return}if(!g.timer||g.timer.pausedAt||timerLeft(g.timer,now)>0)return;
 if(g.engine==='names'){const alive=active(g),id=alive[g.turn%alive.length];delete g.lastPass;delete g.redoNotice;eliminate(g,[id],now);if(!g.result){g.turn%=active(g).length;g.timer={startedAt:g.timer.startedAt+g.timer.duration+g.timer.pauseTotal,duration:10000,pauseTotal:0}}}
 else if(g.engine==='bust'){const alive=active(g),id=alive[g.turn%alive.length];eliminate(g,[id],now);if(!g.result)resetBustRound(g,r,now)}
 else if(g.engine==='reverseSpeed'){const alive=active(g),id=alive[g.turn%alive.length];g.lives[id]--;if(!g.lives[id])eliminate(g,[id],now);g.turn=(g.turn+(g.out.includes(id)?0:1))%Math.max(1,active(g).length);delete g.timer}
 else if(g.engine==='gauntlet')nextGauntlet(g,now);
 else if(g.engine==='hunt'&&n===71&&g.subphase==='headstart'){g.subphase='hunt';g.timer={startedAt:g.timer.startedAt+8000,duration:60000,pauseTotal:0}}
 else if(g.engine==='hunt')sideWin(g,n===71?0:1,now);
 else if(g.engine==='timedGoals'){if([66,76].includes(n))sideWin(g,0,now);else if([67,77].includes(n))sideWin(g,1,now);else{const scores=sideScores(g,g.scores);if(scores[0]===scores[1]){g.phase='overtime';delete g.timer}else sideWin(g,scores[0]>scores[1]?0:1,now)}}
}
function timedAction(g,a,now){const n=nOf(g);need(g.phase==='overtime'||g.engine==='goals'||g.timer&&!g.timer.pausedAt&&timerLeft(g.timer,now)>0&&now>=g.timer.startedAt,'Start the timer, or resolve its expiry.');if(g.engine==='hunt'){if(n===71){need(g.subphase==='hunt');sideWin(g,1,now)}else{need(g.sides[1].includes(a.playerId)&&!g.out.includes(a.playerId));g.out.push(a.playerId);if(g.sides[1].every(id=>g.out.includes(id)))sideWin(g,0,now)}return}
 const side=numeric(a.side,true);need(side<2);if([66,76].includes(n))need(side===1);if([67,77].includes(n))need(side===0);g.scores[g.sides[side][0]]++;
 if(g.phase==='overtime'||[67,77].includes(n)||g.engine==='goals'&&g.scores[g.sides[side][0]]>=2||[66,76].includes(n)&&g.scores[g.sides[1][0]]>=(n===66?3:5))sideWin(g,side,now);
 else if(n===83)g.timer.pausedAt=now;
}
export function rewardDistribution(b){
 const groups=b.game?.result?.placements||[],ids=b.participantIds||[]
 const rewards=Object.fromEntries(ids.map(id=>[id,0]));if(groups.length<=1)return rewards
 const ffa=['1v1v1','1v1v1v1'].includes(b.format||b.game?.format)
 if(!ffa){for(const id of groups[0])rewards[id]=8;return rewards}
 const scale=ids.length===3?[8,4,0]:[8,4,2,0];let rank=0
 // Tied players each receive the lowest payout occupied by their tie group.
 for(const group of groups){const payout=scale[rank+group.length-1]||0;for(const id of group)rewards[id]=payout;rank+=group.length}
 return rewards
}
export function reduceBattle(b,a,uid,seed,now){
 b=clone(b);const r=seeded(seed),host=uid===b.hostId;
 need(b.status==='active','Battle is already complete.');
 need(b.participantIds.includes(uid)||host,'Not a Battle participant.');

 if(a.type==='format'){
  need(host&&b.stage==='format');
  need(FORMAT_SIZES[a.format]<=b.participantIds.length,'Not enough players.');
  b.format=a.format;

  // Challenge Glove: the card owner chooses ONLY the format. The browser
  // secretly/randomly locks the remaining participants and team assignment
  // before the random Challenge is drawn. The card owner always participates.
  if(b.source==='challenge-glove'){
   const needed=FORMAT_SIZES[b.format];
   const others=shuffle(b.availableIds.filter(id=>id!==b.challengerId),r).slice(0,Math.max(0,needed-1));
   const ids=[b.challengerId,...others];
   need(ids.length===needed,'Not enough players for that format.');
   const randomOrder=shuffle(ids,r);
   const sides=b.format==='2v2'?[randomOrder.slice(0,2),randomOrder.slice(2)]
    :b.format==='1v2'?[[randomOrder[0]],randomOrder.slice(1,3)]
    :b.format==='1v3'?[[randomOrder[0]],randomOrder.slice(1,4)]
    :randomOrder.map(id=>[id]);
   b.participantIds=ids;
   b.selectedSides=sides;
   b.stage='draw';
  }else b.stage=b.chooseParticipants?'participants':'draw';
 }
 else if(a.type==='participants'){
  need(host&&b.stage==='participants');const ids=a.sides?.flat();
  need(Array.isArray(ids)&&ids.length===FORMAT_SIZES[b.format]&&new Set(ids).size===ids.length&&ids.includes(b.challengerId)&&ids.every(id=>b.availableIds.includes(id)),'Choose the required players, including yourself.');
  const sizes=a.sides.map(side=>side.length);
  need(b.format==='2v2'?sizes.join(',')==='2,2':b.format==='1v2'?sizes.join(',')==='1,2':b.format==='1v3'?sizes.join(',')==='1,3':sizes.every(x=>x===1),'Choose valid teams.');
  b.selectedSides=a.sides;b.participantIds=ids;b.stage='draw';
 }
 else if(a.type==='next'){
  need(host);b.revealStartedAt=now;
  if(b.stage==='intro') b.stage=b.devSelected?'challengeReveal':b.chooseParticipants?'format':b.format==='1v1'?'draw':'formatReveal';
  else if(b.stage==='formatReveal') b.stage='draw';
  else if(b.stage==='draw'){
   const c=pick(challengePool(b.format),r);b.challengeId=c.id;b.name=c.name;b.stage='challengeReveal';
  }else if(b.stage==='challengeReveal'){
   let ids=shuffle(b.participantIds,r);
   if(FORMAT_SIZES[b.format]<ids.length) ids=[b.challengerId,...ids.filter(id=>id!==b.challengerId)].slice(0,FORMAT_SIZES[b.format]);
   b.participantIds=ids;
   const challenge=CHALLENGE_BY_ID[b.challengeId];
   const secretImposter=challenge?.engine==='imposter';
   if(secretImposter) delete b.selectedSides;
   b.game=createGame(b.challengeId,b.format,ids,r,now,{sides:secretImposter?undefined:b.selectedSides});
   // Imposter team/solo assignment is private. Never run the public team roulette.
   b.stage=secretImposter?'rules':!b.selectedSides&&['2v2','1v2','1v3'].includes(b.format)?'teamReveal':'rules';
  }else if(b.stage==='teamReveal') b.stage='rules';
  else if(b.stage==='rules'){b.stage='play';gameAction(b.game,{type:'start'},uid,true,r,now)}
  else throw Error('Use the Challenge controls.');
 }
 else if(a.type==='game'){
  need(b.stage==='play'||b.stage==='rules'&&a.action.type==='reroll');
  if(a.action.type==='tiebreak'){need(host);startTiebreak(b.game,r)}else gameAction(b.game,a.action,uid,host,r,now);
 }else throw Error('Unknown Battle action.');
 b.version++;return b
}

function kuxirDuel(g,a,uid,host,now){const id=a.playerId||uid;need(g.ids.includes(id)&&(host||uid===id));g.kuxir||={};g.kph||={};if(a.type==='scored'||a.type==='missed'){need(g.kuxir[id]===undefined);g.kuxir[id]=a.type==='scored'}else{need(a.type==='kph'&&g.ids.every(id=>g.kuxir[id]));g.kph[id]=numeric(a.value)}if(!g.ids.every(id=>g.kuxir[id]!==undefined))return;const made=g.ids.filter(id=>g.kuxir[id]);if(made.length===1){sideWin(g,sideOf(g,made[0]),now);return}if(!made.length){g.kuxir={};g.kph={};g.round++;return}if(g.ids.every(id=>g.kph[id]!==undefined)){const [a,b]=g.ids;if(g.kph[a]!==g.kph[b])sideWin(g,sideOf(g,g.kph[a]>g.kph[b]?a:b),now);else{g.kuxir={};g.kph={};g.round++}}}
function placementMatch(parent,old,ids,r,now){if(!old)return createMatch(parent,ids,r,now);const fresh=createGame(old.challengeId,'1v1',ids,r,now);for(const key of ['sprint','playerChosen','setting'])if(old[key]!==undefined)fresh[key]=old[key];if(old.sprint)return createSprint(old.sprint,'1v1',ids,r,now);if(old.playerChosen)fresh.engine='manual';if([28,52].includes(nOf(parent)))fresh.mustResolveWinner=true;return fresh}

export function createSprint(name,format,ids,r,now,options={}) {
 const g=createGame('challenge-1',format,ids,r,now,{sprintBase:true,sides:options.sides});g.sprint=name;
 if(options.sides)g.sides=clone(options.sides);
 g.engine=name==='Freestyle Sprint'?'sprintJudge':name==='KPH Guess Sprint'?'guess':'sprintScore';
 g.sprintAttempts=name==='Crossbar Sprint'?2:1;
 g.sprintSubmitters=name==='Pinch Sprint'&&format==='2v2'?g.sides.map(side=>side[0]):[...ids];
 if(g.engine==='guess'){g.challengeId='challenge-30';g.subphase='guess';g.shot=0;g.commits={};g.reveals={};g.shooters=ffa(g)?[pick(ids,r)]:format==='2v2'?g.sides.map(side=>side[0]):[...g.order]}
 return g;
}
function triathlonEvent(g,r,now){const ids=asymmetric(g)?[g.sides[0][0],g.tiebreakOpponent||g.sides[1][g.eventIndex]]:g.ids;return createSprint(g.events[g.eventIndex],asymmetric(g)?'1v1':g.format,ids,r,now,asymmetric(g)?{}:{sides:g.sides})}
export function finishSprintScores(g,values,now,lower=false){
 if(ffa(g)&&g.groups){g.groups=g.groups.flatMap(group=>group.length>1?groupsBy(group,values,lower):[group]);g.tieGroups=g.groups.filter(group=>group.length>1);if(g.tieGroups.length)g.phase='tiebreak';else result(g,g.groups,now)}
 else settleScores(g,values,now,{lower,ties:false,mode:g.sprint==='Pinch Sprint'?'max':'sum'});
}

export function gameAction(g,a,uid,host,r,now) {
 g.entries||={};g.scores||=Object.fromEntries(g.ids.map(id=>[id,0]));g.out||=[];g.history||=[];
 if(g.tieNotice){need(a.type==='continueTie'&&host,'Read the tie notice before continuing.');delete g.tieNotice;if(g.timer?.pausedAt){g.timer.pauseTotal+=(now-g.timer.pausedAt);delete g.timer.pausedAt}return}
 if(a.type==='announceTie'){need(host&&!g.result&&g.phase==='active');g.tieNotice={message:'The scores are tied. Follow the tiebreak rules below before entering the winner.'};return}
 if(a.type==='nextClosestRound'){need(host&&g.phase==='round-summary');g.entries={};g.round++;g.target=1+Math.floor(r()*150);g.phase='active';delete g.roundWinner;return}
 const before={round:g.round,shot:g.shot,phase:g.phase,subphase:g.subphase,overtime:g.overtime,event:g.eventIndex,turn:g.turn};
 if(g.engine==='draft'&&g.phase==='active'&&['draftAttempt','finishDraftRun'].includes(a.type)){draftAction(g,a,uid,r,now);return}
 if(g.engine==='possession'&&g.phase==='active'&&['possessionStart','possessionResult'].includes(a.type)){possessionAction(g,a,uid,now);return}
 applyGameAction(g,a,uid,host,r,now);
 if(g.result||g.phase==='tiebreak'||a.type==='continueTie'||a.type==='restart'||a.type==='undo')return;
 const repeated=(g.engine==='airdribble'&&g.groups&&g.turn===0&&before.turn>0)||(['heads','combo','reset2'].includes(g.engine)&&g.round>before.round)||
  (g.engine==='target'&&g.shot>=6&&g.shot>before.shot&&(g.shot-6)%2===0)||
  (g.engine==='guess'&&before.shot>0&&g.shot===0)||
  (g.engine==='imposter'&&before.subphase==='vote'&&g.subphase==='freeClues')||
  (!before.overtime&&g.overtime)||(!before.phase?.includes('overtime')&&g.phase==='overtime')||
  (g.engine==='triathlon'&&!g.result&&g.eventIndex>=g.events.length-1&&g.tiebreakOpponent);
 if(repeated){g.tieNotice={message:g.engine==='target'?'Scores tied! Each side gets one extra attacking possession, then compare totals again.':g.engine==='imposter'?'The vote is tied. Everyone gives another clue, then votes again.':'No winner yet! Continue with the tiebreak rules for this game.'};if(g.timer&&!g.timer.pausedAt)g.timer.pausedAt=now;}
}
function draftAction(g,a,uid,r,now){
 const id=g.order[g.turn];need(uid===id,'Wait for your turn.');need(Array.isArray(a.counts)&&a.counts.length===3);
 const counts=a.counts.map(v=>numeric(v,true));need(counts.every(v=>v<=100),'Enter at most 100 of each mechanic.');
 const points=a.made===false?0:sum(counts.map((v,i)=>v*(i+1)));
 g.scores[id]=(g.scores[id]||0)+points;g.entries[id]||=[];g.entries[id].push(points);g.attempt=(g.attempt||0)+1;
 if(g.draftTimed&&a.type==='finishDraftRun'||!g.draftTimed&&g.attempt===3){g.turn++;g.attempt=0}
 if(g.turn<g.order.length)return;
 if(ffa(g)&&g.groups){g.groups=g.groups.flatMap(group=>group.length>1?groupsBy(group,g.scores):[group]);g.tieGroups=g.groups.filter(group=>group.length>1);if(!g.tieGroups.length){result(g,g.groups,now);return}g.phase='tiebreak'}
 else settleScores(g,g.scores,now,{ties:false,weighted:true});
 if(g.phase==='tiebreak'){g.draft=draft(r);g.order=shuffle(ffa(g)?g.tieGroups.flat():g.ids,r);g.turn=0;g.attempt=0;g.entries={};g.scores=Object.fromEntries(g.ids.map(id=>[id,0]));}
}
function possessionAction(g,a,uid,now){
 const n=nOf(g),id=g.possessionOrder[g.possessionIndex];need(uid===id,'Only the attacker can enter this possession.');
 const seconds=g.possessionRound>1?10:[30,20,10][g.attempt];
 if(a.type==='possessionStart'){need(n===25&&!g.timer);g.timer=timer(now,seconds*1000);return}
 const value=numeric(a.value,true);need(value<=2);
 if(n===25){need(g.timer,'Start the possession first.');need(now>=g.timer.startedAt,'Wait for the start.');need(value<=1);g.scores[id]+=value?(g.possessionRound>1?3:g.attempt+1):0;}else g.scores[id]+=value;
 delete g.timer;g.attempt++;
 if(g.attempt===(g.possessionRound>1?1:3)){g.attempt=0;g.possessionIndex++}
 if(g.possessionIndex===g.possessionOrder.length){
 if(ffa(g)&&g.groups){g.groups=g.groups.flatMap(group=>group.length>1?groupsBy(group,g.scores):[group]);g.tieGroups=g.groups.filter(group=>group.length>1);if(!g.tieGroups.length){result(g,g.groups,now);return}g.phase='tiebreak'}else settleScores(g,g.scores,now,{ties:false});
 if(g.phase==='tiebreak'){g.possessionRound++;g.round++;g.possessionIndex=0;if(ffa(g))g.possessionOrder=g.tieGroups.flat();}
 }
}
