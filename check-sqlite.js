const { DatabaseSync } = require('node:sqlite');
const banco = new DatabaseSync('c:/Users/User/Desktop/barbershop - Copia2026/dados/barbershop.db');

try {
    const ags = banco.prepare("SELECT * FROM agendamentos").all();
    console.log("Total agendamentos:", ags.length);
    console.log("Agendamentos 16:30:", ags.filter(a => a.horario_agendamento === "16:30"));
    
    const blqs = banco.prepare("SELECT * FROM bloqueios_horario").all();
    console.log("Total bloqueios:", blqs.length);
    console.log("Bloqueios 16:30:", blqs.filter(b => b.horario_agendamento === "16:30"));
} catch(e) {
    console.error(e);
}
