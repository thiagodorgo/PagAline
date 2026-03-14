import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { addDays, subDays } from 'date-fns';

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

interface UserProfile {
  name: string;
  plan: string;
  customPhotoUrl?: string; // Added to support custom photo upload
}

interface AppState {
  bills: Bill[];
  categories: string[];
  userProfile: UserProfile;
  monthlyGoal: number;
  
  addBill: (bill: Omit<Bill, 'id' | 'createdAt'>) => void;
  updateBill: (id: string, bill: Partial<Bill>) => void;
  markAsPaid: (id: string) => void;
  markMultipleAsPaid: (ids: string[]) => void;
  deleteBill: (id: string) => void;
  
  getCategories: () => string[];
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
  
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateMonthlyGoal: (goal: number) => void;
  
  resetData: () => void;
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      bills: mockBills,
      categories: initialCategories,
      userProfile: {
        name: 'Aline Silva',
        plan: 'Plano Premium'
      },
      monthlyGoal: 5000,
      
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

      getCategories: () => get().categories,
      
      addCategory: (category) => {
        if (!get().categories.includes(category)) {
          set((state) => ({ categories: [...state.categories, category] }));
        }
      },
      
      deleteCategory: (category) => {
        set((state) => ({ 
          categories: state.categories.filter(c => c !== category) 
        }));
      },
      
      updateUserProfile: (profile) => {
        set((state) => ({
          userProfile: { ...state.userProfile, ...profile }
        }));
      },
      
      updateMonthlyGoal: (goal) => {
        set({ monthlyGoal: goal });
      },
      
      resetData: () => {
        set({
          bills: mockBills,
          categories: initialCategories,
          monthlyGoal: 5000,
          userProfile: {
            name: 'Aline Silva',
            plan: 'Plano Premium'
          }
        });
      }
    }),
    {
      name: 'pagaline-storage',
      // Convert dates correctly when hydrating from localStorage
      merge: (persistedState: any, currentState) => {
        if (persistedState && persistedState.bills) {
          persistedState.bills = persistedState.bills.map((bill: any) => ({
            ...bill,
            dueDate: new Date(bill.dueDate),
            createdAt: new Date(bill.createdAt),
            paidDate: bill.paidDate ? new Date(bill.paidDate) : undefined,
          }));
        }
        return { ...currentState, ...persistedState };
      },
    }
  )
);
