import { insertBillSchema } from "./shared/schema.ts";

const sample = {
  description: "Teste",
  amount: 12.34,
  dueDate: new Date().toISOString(),
  category: "Outros",
  status: "pending",
};

console.log(JSON.stringify(insertBillSchema.safeParse(sample), null, 2));
