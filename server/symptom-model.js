// Lightweight local TF-IDF specialty recommender for the final-year-project demo.
// It recommends a care specialty only; it does not diagnose diseases or prescribe treatment.
const training = {
  Cardiology: ['chest pain pressure heartbeat palpitations breathlessness blood pressure', 'heart racing chest tightness dizziness swelling ankles'],
  Dermatology: ['skin rash itching red patches acne eczema dry skin hives', 'itchy spots irritation scalp rash pigmentation'],
  Neurology: ['headache migraine dizziness numbness tingling seizure weakness memory', 'severe recurring headache balance vision nerve pain'],
  Orthopedics: ['joint pain knee back pain fracture bone sprain muscle swelling', 'shoulder injury hip pain stiffness ankle pain'],
  Pediatrics: ['child baby infant fever growth vaccination feeding pediatric', 'toddler child cough appetite development'],
  'General Medicine': ['fever cough cold tired weakness stomach pain nausea infection', 'general health check fatigue vomiting diarrhea body pain'],
  'Emergency care': ['severe chest pain unconscious fainting heavy bleeding cannot breathe stroke suicide', 'difficulty breathing sudden weakness severe injury emergency'],
};
const tokenize = text => String(text||'').toLowerCase().match(/[a-z]{2,}/g)||[];
const docs = Object.entries(training).flatMap(([specialty,examples])=>examples.map(text=>({specialty,tokens:tokenize(text)})));
const vocabulary = [...new Set(docs.flatMap(doc=>doc.tokens))];
const idf = Object.fromEntries(vocabulary.map(term=>[term,Math.log((1+docs.length)/(1+docs.filter(doc=>doc.tokens.includes(term)).length))+1]));
const vector = tokens => { const counts={};tokens.forEach(token=>counts[token]=(counts[token]||0)+1);return vocabulary.map(term=>(counts[term]||0)/Math.max(tokens.length,1)*idf[term]); };
const cosine = (a,b) => { const dot=a.reduce((sum,value,index)=>sum+value*b[index],0), normA=Math.sqrt(a.reduce((sum,value)=>sum+value*value,0)), normB=Math.sqrt(b.reduce((sum,value)=>sum+value*value,0));return normA&&normB?dot/(normA*normB):0; };
const prototypes=Object.fromEntries(Object.keys(training).map(specialty=>{const rows=docs.filter(doc=>doc.specialty===specialty).map(doc=>vector(doc.tokens));return [specialty,vocabulary.map((_,index)=>rows.reduce((sum,row)=>sum+row[index],0)/rows.length)];}));
export function recommendSpecialty(symptoms){const query=vector(tokenize(symptoms));const scores=Object.entries(prototypes).map(([specialty,row])=>({specialty,score:cosine(query,row)})).sort((a,b)=>b.score-a.score);const choice=scores[0]?.score>0? scores[0].specialty:'General Medicine';return {recommendedSpecialty:choice,message:choice==='Emergency care'?'Possible emergency warning signs were detected. Seek emergency services now.':`A ${choice} consultation is an appropriate place to start.`,confidence:Math.round((scores[0]?.score||0)*100)};}
