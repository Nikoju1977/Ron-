/* RON · Autonomie opérationnelle (pas une conscience subjective).
 * Pure, deterministic scheduling/safety model shared by RON and RON Présence.
 * No credentials, network calls, hidden execution or background promises.
 */
(function(root){
'use strict';
const DAILY_LIMIT=24;
const MIN_INTERVAL=60000;
function nowDay(now){return new Date(now).toISOString().slice(0,10);}
function numeric(value,defaultValue=0){const n=Number(value);return Number.isFinite(n)&&n>=0?n:defaultValue;}
function mind(previous,now=Date.now()){
 const m=previous&&typeof previous==='object'?previous:{};
 const day=nowDay(now);
 const sameDay=m.day===day;
 return {
   day, cycles:sameDay?Math.min(DAILY_LIMIT,numeric(m.cycles)):0,
   failures:sameDay?Math.min(8,numeric(m.failures)):0,
   // The device clock may move backwards; never freeze an agent until a future timestamp.
   lastAttemptAt:Math.min(now,numeric(m.lastAttemptAt)),
   lastCycleAt:Math.min(now,numeric(m.lastCycleAt)),
   nextAt:0,
   focus:String(m.focus||'').slice(0,160),
   reflection:String(m.reflection||'').slice(0,400),
   uncertainty:String(m.uncertainty||'').slice(0,240)
 };
}
function inspect(input){
 const o=input||{},clock=numeric(o.now,Date.now()),m=mind(o.mind,clock);
 if(!o.enabled)return {mode:'disabled',reason:'Activation nécessaire',mind:m};
 if(o.paused)return {mode:'paused',reason:'Pause demandée',mind:m};
 if(!o.hasMission)return {mode:'idle',reason:'Aucune mission active',mind:m};
 if(!o.visible)return {mode:'suspended',reason:'Application en arrière-plan : aucun cycle lancé',mind:m};
 if(!o.engineReady)return {mode:'blocked',reason:'Moteur IA non disponible',mind:m};
 if(o.needsKey)return {mode:'approval',reason:'IA avec clé : lancement manuel uniquement pour éviter des dépenses',mind:m};
 if(o.cooldownUntil>clock)return {mode:'cooldown',reason:'Pause du fournisseur',mind:m,delay:Math.max(1000,o.cooldownUntil-clock)};
 if(m.cycles>=DAILY_LIMIT){
   // Without a wake-up at UTC midnight, reaching the budget freezes autonomy forever
   // until the user manually interacts with the page.
   const midnight=Date.parse(m.day+'T00:00:00.000Z')+86400000;
   return {mode:'budget',reason:'Plafond de 24 cycles autonomes par jour atteint',
     mind:m,delay:Math.max(1000,midnight-clock)};
 }
 if(o.running)return {mode:'working',reason:'Cycle en cours',mind:m};
 const interval=Math.max(MIN_INTERVAL,numeric(o.interval,120000));
 const backoff=m.failures?Math.min(3600000,MIN_INTERVAL*Math.pow(2,Math.min(5,m.failures))):0;
 const due=m.lastAttemptAt?m.lastAttemptAt+Math.max(interval,backoff):clock;
 const delay=Math.max(0,due-clock);
 return {mode:delay?'scheduled':'ready',reason:delay?'Prochain cycle planifié':'Prêt à analyser la mission',mind:m,delay};
}
function observe(mission,json){
 const original=mission||{},j=json||{};
 const text=v=>String(v==null?'':v).trim();
 const prior=text(original.nextStep).toLocaleLowerCase('fr');
 const next=text(j.next_step).toLocaleLowerCase('fr');
 const oldProgress=Math.min(100,numeric(original.progress));
 const estimated=Math.max(0,Math.min(100,numeric(j.progress,oldProgress)));
 const status=['active','waiting','done'].includes(j.status)?j.status:(j.needs_user?'waiting':'active');
 const stalled=status==='active' && next===prior && estimated<=oldProgress;
 const stalls=stalled?Math.min(3,numeric(original.stalls)+1):0;
 const requestHelp=!!j.needs_user||status==='waiting'||stalls>=3;
 return {
   status:requestHelp?'waiting':status,
   progress:Math.max(oldProgress,estimated),
   stalls,
   question:requestHelp?(text(j.question)|| (stalls>=3?'Aucune progression vérifiable après trois cycles. Quelle direction prendre ?':'Quelle décision dois-je prendre ?')).slice(0,400):'',
   reflection:text(j.self_check||'').slice(0,400) || (stalled?'L’étape proposée répète la précédente.':'Plan de travail réévalué.'),
   uncertainty:text(j.uncertainty||'').slice(0,240)
 };
}
root.RONAutonomy=Object.freeze({DAILY_LIMIT,MIN_INTERVAL,mind,inspect,observe});
})(typeof window!=='undefined'?window:globalThis);
