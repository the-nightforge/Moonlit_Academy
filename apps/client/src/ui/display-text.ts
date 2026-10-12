/** Expand player-facing terms without changing authoritative rules/data. */
export const displayText=(text:string)=>text.replace(/\bdamage\b/g,'sát thương').replace(/\bHP\b/g,'máu');
