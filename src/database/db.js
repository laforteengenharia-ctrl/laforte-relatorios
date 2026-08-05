import Dexie from "dexie";

export const db = new Dexie("LaForteRelatoriosDB");

db.version(1).stores({
  contratos: "++id, numero, nome, cliente, status",
  frentes: "++id, contratoId, nome, ordem",
  medicoes: "++id, contratoId, numero, status",
  fotos: "++id, medicaoId, frenteId, ordem",
  legendas: "++id, contratoId, titulo",
  auditoria: "++id, data, acao"
});