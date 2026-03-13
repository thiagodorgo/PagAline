import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { addDays, subDays, startOfMonth, format } from 'date-fns';

export type BillStatus = 'pending' | 'paid' | 'overdue';

export interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: Date;
  category: string;
  status: BillStatus;
  notes?: string;
  imageUrl?: string;
  paidDate?: Date;
  createdAt: Date;
}

interface AppState {
  bills: Bill[];
  addBill: (bill: Omit<Bill, 'id' | 'createdAt'>) => void;
  updateBill: (id: string, bill: Partial<Bill>) => void;
  markAsPaid: (id: string) => void;
  markMultipleAsPaid: (ids: string[]) => void;
  deleteBill: (id: string) => void;
  getCategories: () => string[];
}

const initialCategories = ['Casa', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Impostos', 'Outros'];

const mockBills: Bill[] = [
  {
    id: uuidv4(),
    description: 'Aluguel',
    amount: 1500.00,
    dueDate: new Date(),
    category: 'Casa',
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: uuidv4(),
    description: 'Conta de Luz',
    amount: 180.50,
    dueDate: addDays(new Date(), 2),
    category: 'Casa',
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: uuidv4(),
    description: 'Internet',
    amount: 99.90,
    dueDate: addDays(new Date(), 5),
    category: 'Casa',
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: uuidv4(),
    description: 'Mensalidade Escola',
    amount: 850.00,
    dueDate: subDays(new Date(), 1),
    category: 'Educação',
    status: 'overdue',
    createdAt: new Date(),
  },
  {
    id: uuidv4(),
    description: 'Plano de Saúde',
    amount: 450.00,
    dueDate: subDays(new Date(), 10),
    category: 'Saúde',
    status: 'paid',
    paidDate: subDays(new Date(), 10),
    createdAt: new Date(),
  }
];

export const useStore = create<AppState>((set, get) => ({
  bills: mockBills,
  
  addBill: (billData) => {
    const newBill: Bill = {
      ...billData,
      id: uuidv4(),
      createdAt: new Date(),
    };
    set((state) => ({ bills: [...state.bills, newBill] }));
  },
  
  updateBill: (id, billData) => {
    set((state) => ({
      bills: state.bills.map((bill) => 
        bill.id === id ? { ...bill, ...billData } : bill
      ),
    }));
  },
  
  markAsPaid: (id) => {
    set((state) => ({
      bills: state.bills.map((bill) => 
        bill.id === id ? { ...bill, status: 'paid', paidDate: new Date() } : bill
      ),
    }));
  },

  markMultipleAsPaid: (ids) => {
    set((state) => ({
      bills: state.bills.map((bill) => 
        ids.includes(bill.id) ? { ...bill, status: 'paid', paidDate: new Date() } : bill
      ),
    }));
  },
  
  deleteBill: (id) => {
    set((state) => ({
      bills: state.bills.filter((bill) => bill.id !== id),
    }));
  },

  getCategories: () => initialCategories,
}));
