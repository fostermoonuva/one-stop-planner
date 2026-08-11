import { useState, useMemo } from "react";
import { 
  Wallet, Plus, TrendingUp, TrendingDown, MoreHorizontal, 
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, 
  Settings, X, CreditCard,
  Target, ArrowRight, Clock, Shield
} from "lucide-react";

// ─── Enhanced Types ───────────────────────────────────────────────────────────
export interface Account {
  id: string;
  name: string;
  type: "checking" | "credit" | "cash" | "hysa" | "investment" | "savings";
  currentBalance: number;
  creditLimit?: number;
  creditUtilizationAlertThreshold?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  type: "expense" | "income";
  icon?: string;
}

export interface BudgetCategory extends Category {
  monthlyCap: number;
}

export interface MonthlyBudgetCategory {
  id: string;
  categoryId: string;
  monthKey: string;
  allocatedAmount: number;
}

export type PaymentMethod = "debit" | "credit" | "cash";
export type FlowType = "spending" | "saving" | "investing" | "income";
export type TransactionType = "expense" | "income" | "transfer" | "credit_payment";

export interface BudgetTransaction {
  id: string;
  categoryId: string;
  amount: number;
  description: string;
  date: string;
  type: TransactionType;
  accountId: string;
  fromAccountId?: string;
  toAccountId?: string;
  paymentMethod: PaymentMethod;
  isCreditPaid: boolean;
  flowType: FlowType;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  description: string;
  amount: number;
  flowType: FlowType;
}

export interface CategoryGroupSet {
  id: string;
  name: string;
  categories: { name: string; color: string; monthlyCap: number }[];
}

export interface IncomeMilestone {
  date: string; // "YYYY-MM"
  amount: number;
}

export interface OutlookProjection {
  incomeMilestones: IncomeMilestone[];
  expenseEscalationRates: Record<string, number>;
  liquidGrowthRate: number;
  investmentGrowthRate: number;
}

export interface BudgetMetadata {
  lastUpdatedByMonth: Record<string, string>; // "YYYY-MM" -> ISO timestamp
  lastBudgetUpdate: string;
}

export interface SurplusCarryover {
  id: string;
  fromMonth: string;
  toMonth: string;
  amount: number;
  applied: boolean;
}

interface BudgetViewProps {
  categories: Category[];
  monthlyBudgetCategories: MonthlyBudgetCategory[];
  transactions: BudgetTransaction[];
  accounts: Account[];
  categoryGroupSets: CategoryGroupSet[];
  transactionItems: TransactionItem[];
  budgetMetadata: BudgetMetadata | null;
  surplusCarryovers: SurplusCarryover[];
  
  // Callbacks
  onAddCategory: (category: Category) => void;
  onAddMonthlyCategory: (monthlyCat: MonthlyBudgetCategory) => void;
  onUpdateMonthlyCategory: (monthlyCat: MonthlyBudgetCategory) => void;
  onRemoveMonthlyCategory: (monthlyCatId: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddTransaction: (transaction: BudgetTransaction) => void;
  onUpdateTransaction: (transaction: BudgetTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransactionItem: (item: TransactionItem) => void;
  onAddAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
  onUpdateAccount: (account: Account) => void;
  onUpdateAccounts: (accounts: Account[]) => void;
  onSaveCategoryGroupSet: (set: CategoryGroupSet) => void;
  onApplyCategoryGroupSet: (setId: string) => void;
  onUpdateBudgetMetadata: (metadata: BudgetMetadata) => void;
  onCreateSurplusCarryover: (carryover: SurplusCarryover) => void;
  onMarkSurplusApplied: (carryoverId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const getMonthKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthTransactions = (transactions: BudgetTransaction[], monthKey: string) => {
  return transactions.filter(t => t.date.startsWith(monthKey));
};

const getCategoryTotal = (transactions: BudgetTransaction[], categoryId: string, monthKey: string) => {
  return getMonthTransactions(transactions, monthKey)
    .filter(t => t.categoryId === categoryId && t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
};

const getDaysInMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
};

const getDaysElapsed = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const today = new Date();
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) {
    return getDaysInMonth(monthKey);
  }
  return today.getDate();
};

const calculateDailySpendingRate = (transactions: BudgetTransaction[], monthKey: string, monthlyCats: MonthlyBudgetCategory[], categories: Category[]) => {
  const monthTrans = getMonthTransactions(transactions, monthKey);
  const totalSpent = monthTrans
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const daysElapsed = getDaysElapsed(monthKey);
  const daysInMonth = getDaysInMonth(monthKey);
  
  if (daysElapsed === 0) return { current: 0, projected: 0, totalBudget: 0 };
  
  const dailyRate = totalSpent / daysElapsed;
  const projectedMonthly = dailyRate * daysInMonth;
  
  const totalBudget = monthlyCats.reduce((sum, mc) => {
    const cat = categories.find(c => c.id === mc.categoryId);
    return sum + (cat && cat.type === "expense" ? mc.allocatedAmount : 0);
  }, 0);
  
  return { current: dailyRate, projected: projectedMonthly, totalBudget };
};

const calculateAccountBalances = (accounts: Account[], transactions: BudgetTransaction[]) => {
  // Use ALL transactions across all months to calculate true account balances
  // The account's currentBalance is the starting balance, and we adjust it with all historical transactions
  return accounts.map(account => {
    const accountTrans = transactions.filter(t => t.accountId === account.id);
    const income = accountTrans
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = accountTrans
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Transfers: money leaving this account (from) decreases balance, money arriving (to) increases balance
    const transfersOut = transactions
      .filter(t => t.type === "transfer" && t.fromAccountId === account.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const transfersIn = transactions
      .filter(t => t.type === "transfer" && t.toAccountId === account.id)
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Credit payments: money leaving this account (from) decreases balance, money arriving (to) increases balance
    const creditPaymentsOut = transactions
      .filter(t => t.type === "credit_payment" && t.fromAccountId === account.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const creditPaymentsIn = transactions
      .filter(t => t.type === "credit_payment" && t.toAccountId === account.id)
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate balance based on account type
    let calculatedBalance: number;
    if (account.type === "credit") {
      // Credit card: expenses increase debt (more negative), payments decrease debt (less negative)
      // Start from currentBalance (should be negative or zero), subtract expenses (more debt), add payments (less debt)
      calculatedBalance = account.currentBalance - expenses + creditPaymentsIn - creditPaymentsOut;
    } else {
      // Liquid accounts (checking, savings, cash, hysa, investment): normal balance calculation
      calculatedBalance = account.currentBalance + income - expenses - transfersOut + transfersIn - creditPaymentsOut + creditPaymentsIn;
    }
    
    return {
      ...account,
      currentBalance: calculatedBalance
    };
  });
};

// ─── Budget View ──────────────────────────────────────────────────────────────
export default function BudgetView({
  categories,
  monthlyBudgetCategories,
  transactions,
  accounts,
  categoryGroupSets,
  budgetMetadata,
  surplusCarryovers,
  onAddCategory,
  onAddMonthlyCategory,
  onUpdateMonthlyCategory,
  onRemoveMonthlyCategory,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onAddAccount,
  onDeleteAccount,
  onUpdateAccount,
  onUpdateAccounts,
  onSaveCategoryGroupSet,
  onApplyCategoryGroupSet,
}: BudgetViewProps) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showCategoryGroupSets, setShowCategorySets] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showTransactionDetail, setShowTransactionDetail] = useState<BudgetTransaction | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const [newGroupSetName, setNewGroupSetName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366F1");
  
  const [newTransactionAmount, setNewTransactionAmount] = useState("");
  const [newTransactionDescription, setNewTransactionDescription] = useState("");
  const [newTransactionCategory, setNewTransactionCategory] = useState("");
  const [newTransactionType, setNewTransactionType] = useState<"expense" | "income" | "transfer" | "credit_payment">("expense");
  const [newTransactionDate, setNewTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTransactionAccount, setNewTransactionAccount] = useState("");
  const [newTransactionFromAccount, setNewTransactionFromAccount] = useState("");
  const [newTransactionToAccount, setNewTransactionToAccount] = useState("");
  const [newTransactionPaymentMethod, setNewTransactionPaymentMethod] = useState<PaymentMethod>("debit");
  const [newTransactionFlowType, setNewTransactionFlowType] = useState<FlowType>("spending");
  
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<Account["type"]>("checking");
  const [newAccountBalance, setNewAccountBalance] = useState("");
  const [newAccountCreditLimit, setNewAccountCreditLimit] = useState("");

  // Add Transaction Step Navigation
  const [newTransactionStep, setNewTransactionStep] = useState<1 | 2>(1);

  const currentMonthKey = getMonthKey(currentMonth);
  const monthTransactions = getMonthTransactions(transactions, currentMonthKey);
  
  // Get monthly category allocations for current month
  const currentMonthCategories = useMemo(() => {
    return monthlyBudgetCategories
      .filter(mc => mc.monthKey === currentMonthKey)
      .map(mc => {
        const category = categories.find(c => c.id === mc.categoryId);
        if (!category) return null;
        return {
          ...category,
          monthlyId: mc.id,
          monthlyCap: mc.allocatedAmount,
        };
      })
      .filter((cat): cat is Category & { monthlyId: string; monthlyCap: number } => cat !== null);
  }, [monthlyBudgetCategories, currentMonthKey, categories]);

  // ─── 3-Metric Financial Matrix ─────────────────────────────────────────────
  const financialMetrics = useMemo(() => {
    // 1. Income: Total income received for the month
    const income = monthTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    
    // 2. Spending: Total expenses (all flow types that represent spending)
    const spending = monthTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    
    // 3. Invest: Total amount transferred into investment/brokerage accounts
    const invest = monthTransactions
      .filter(t => t.type === "transfer" && t.toAccountId)
      .filter(t => {
        const toAccount = accounts.find(a => a.id === t.toAccountId);
        return toAccount?.type === "investment";
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // 4. Net Savings Transfers: Money moved to/from HYSA or Savings
    const savingsTransfers = monthTransactions
      .filter(t => t.type === "transfer")
      .filter(t => {
        const fromAccount = accounts.find(a => a.id === t.fromAccountId);
        const toAccount = accounts.find(a => a.id === t.toAccountId);
        const isSavingsAccount = (acc: Account | undefined) => 
          acc?.type === "hysa" || acc?.type === "savings";
        return isSavingsAccount(fromAccount) || isSavingsAccount(toAccount);
      })
      .reduce((sum, t) => {
        const fromAccount = accounts.find(a => a.id === t.fromAccountId);
        const toAccount = accounts.find(a => a.id === t.toAccountId);
        const isFromSavings = fromAccount?.type === "hysa" || fromAccount?.type === "savings";
        const isToSavings = toAccount?.type === "hysa" || toAccount?.type === "savings";
        
        // ADD amounts transferred INTO savings, SUBTRACT amounts transferred OUT
        if (isToSavings && !isFromSavings) return sum + t.amount; // Into savings
        if (isFromSavings && !isToSavings) return sum - t.amount; // Out of savings
        return sum; // Between savings accounts, net zero
      }, 0);

    // 5. Saving = (Income - Spending - Invest) + Net Savings Transfers
    const saving = (income - spending - invest) + savingsTransfers;

    // Previous surplus carryover
    const previousSurplus = surplusCarryovers
      .filter(sc => sc.toMonth === currentMonthKey && !sc.applied)
      .reduce((sum, sc) => sum + sc.amount, 0);

    return {
      income,
      spending,
      invest,
      saving,
      previousSurplus
    };
  }, [monthTransactions, accounts, surplusCarryovers, currentMonthKey]);

  const totalExpenses = monthTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = monthTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  const sortedTransactions = [...monthTransactions].sort((a, b) => 
    b.date.localeCompare(a.date)
  );

  // Financial analytics
  const spendingAnalytics = useMemo(() => {
    return calculateDailySpendingRate(transactions, currentMonthKey, monthlyBudgetCategories, categories);
  }, [transactions, currentMonthKey, monthlyBudgetCategories, categories]);

  const accountBalances = useMemo(() => {
    return calculateAccountBalances(accounts, transactions);
  }, [accounts, transactions]);

  const liquidAssetsTotal = accountBalances
    .filter(acc => acc.type !== "credit")
    .reduce((sum, acc) => sum + acc.currentBalance, 0);
  
  const creditUsedTotal = accountBalances
    .filter(acc => acc.type === "credit")
    .reduce((sum, acc) => sum + Math.abs(acc.currentBalance), 0);

  const overspentCategories = useMemo(() => {
    return currentMonthCategories
      .map(cat => ({
        ...cat,
        spent: getCategoryTotal(transactions, cat.id, currentMonthKey),
        over: getCategoryTotal(transactions, cat.id, currentMonthKey) - cat.monthlyCap
      }))
      .filter(cat => cat.over > 0)
      .sort((a, b) => b.over - a.over);
  }, [currentMonthCategories, transactions, currentMonthKey]);

  const paceStatus = useMemo(() => {
    const { projected, totalBudget } = spendingAnalytics;
    if (totalBudget === 0) return { status: "no-budget", label: "No Budget Set", color: "#78716C" };
    
    const ratio = projected / totalBudget;
    if (ratio > 1) return { status: "over", label: "Over Budget", color: "#EF4444" };
    if (ratio > 0.9) return { status: "near", label: "Near Limit", color: "#EAB308" };
    return { status: "on-track", label: "On Track", color: "#10B981" };
  }, [spendingAnalytics]);

  // Credit card utilization alerts
  const creditCardAlerts = useMemo(() => {
    return accountBalances
      .filter(acc => acc.type === "credit" && acc.creditLimit)
      .map(acc => {
        const utilization = Math.abs(acc.currentBalance) / acc.creditLimit! * 100;
        const threshold = acc.creditUtilizationAlertThreshold || 10;
        return {
          account: acc,
          utilization,
          threshold,
          isOverThreshold: utilization > threshold
        };
      });
  }, [accountBalances]);

  // Negative balance alerts for liquid accounts
  const negativeBalanceAlerts = useMemo(() => {
    return accountBalances.filter(acc => 
      acc.type !== "credit" && acc.currentBalance < 0
    );
  }, [accountBalances]);

  // Get last updated timestamp for current month
  const lastUpdated = budgetMetadata?.lastUpdatedByMonth[currentMonthKey];
  const lastUpdatedFormatted = lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }) : null;

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    onAddCategory({
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
      type: "expense",
    });
    setNewCategoryName("");
    setShowAddCategory(false);
  };

  const handleAddTransaction = () => {
    if (!newTransactionAmount || newTransactionAmount === "") return;
    
    const amount = Number(newTransactionAmount);
    if (isNaN(amount)) return;
    
    if (newTransactionType === "transfer") {
      // Transfer validation: both accounts required and must differ
      if (!newTransactionFromAccount || !newTransactionToAccount) return;
      if (newTransactionFromAccount === newTransactionToAccount) return;
      
      onAddTransaction({
        id: Date.now().toString(),
        categoryId: newTransactionCategory || "",
        amount: Number(newTransactionAmount),
        description: newTransactionDescription,
        date: newTransactionDate,
        type: "transfer",
        accountId: newTransactionFromAccount,
        fromAccountId: newTransactionFromAccount,
        toAccountId: newTransactionToAccount,
        paymentMethod: "debit",
        isCreditPaid: true,
        flowType: "saving",
      });
    } else if (newTransactionType === "credit_payment") {
      // Credit payment validation: both accounts required and must differ
      if (!newTransactionFromAccount || !newTransactionToAccount) return;
      if (newTransactionFromAccount === newTransactionToAccount) return;
      
      const fromAccount = accounts.find(a => a.id === newTransactionFromAccount);
      const toAccount = accounts.find(a => a.id === newTransactionToAccount);
      
      // Validate that fromAccount is a liquid account and toAccount is a credit account
      if (!fromAccount || !toAccount) return;
      if (fromAccount.type === "credit" || toAccount.type !== "credit") return;
      
      onAddTransaction({
        id: Date.now().toString(),
        categoryId: "",
        amount: Number(newTransactionAmount),
        description: newTransactionDescription || "Credit Card Payment",
        date: newTransactionDate,
        type: "credit_payment",
        accountId: newTransactionFromAccount,
        fromAccountId: newTransactionFromAccount,
        toAccountId: newTransactionToAccount,
        paymentMethod: "debit",
        isCreditPaid: true,
        flowType: "saving",
      });
    } else {
      // For expense/income transactions
      if (!newTransactionAccount) return;
      
      const selectedAccount = accounts.find(a => a.id === newTransactionAccount);
      if (!selectedAccount) return;
      
      // For income transactions, category is optional (use empty string if not provided)
      // For expense transactions, category is required
      if (newTransactionType === "expense" && !newTransactionCategory) return;
      
      const categoryId = newTransactionCategory || "";
      
      // If credit account is selected for expense, automatically use credit_payment type
      if (newTransactionType === "expense" && selectedAccount.type === "credit") {
        // This is a credit card charge - reduce the credit balance (make it more negative)
        onAddTransaction({
          id: Date.now().toString(),
          categoryId: categoryId,
          amount: Number(newTransactionAmount),
          description: newTransactionDescription,
          date: newTransactionDate,
          type: "expense",
          accountId: newTransactionAccount,
          paymentMethod: "credit",
          isCreditPaid: false,
          flowType: newTransactionFlowType,
        });
      } else {
        // Normal expense/income transaction
        onAddTransaction({
          id: Date.now().toString(),
          categoryId: categoryId,
          amount: Number(newTransactionAmount),
          description: newTransactionDescription,
          date: newTransactionDate,
          type: newTransactionType,
          accountId: newTransactionAccount,
          paymentMethod: newTransactionPaymentMethod,
          isCreditPaid: newTransactionPaymentMethod !== "credit",
          flowType: newTransactionFlowType,
        });
      }
    }
    
    // Reset all form state
    setNewTransactionAmount("");
    setNewTransactionDescription("");
    setNewTransactionCategory("");
    setNewTransactionType("expense");
    setNewTransactionDate(new Date().toISOString().split("T")[0]);
    setNewTransactionAccount("");
    setNewTransactionFromAccount("");
    setNewTransactionToAccount("");
    setNewTransactionPaymentMethod("debit");
    setNewTransactionFlowType("spending");
    setNewTransactionStep(1); // Reset to step 1
    setShowAddTransaction(false);
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim() || !newAccountBalance) return;
    onAddAccount({
      id: Date.now().toString(),
      name: newAccountName.trim(),
      type: newAccountType,
      currentBalance: Number(newAccountBalance),
      creditLimit: newAccountType === "credit" ? Number(newAccountCreditLimit) || undefined : undefined,
    });
    setNewAccountName("");
    setNewAccountBalance("");
    setNewAccountCreditLimit("");
    setShowAccounts(false);
  };

  const handleSaveCategoryGroupSet = () => {
    if (!newGroupSetName.trim() || currentMonthCategories.length === 0) return;
    onSaveCategoryGroupSet({
      id: Date.now().toString(),
      name: newGroupSetName.trim(),
      categories: currentMonthCategories.map(cat => ({
        name: cat.name,
        color: cat.color,
        monthlyCap: cat.monthlyCap,
      })),
    });
    setNewGroupSetName("");
    setShowCategorySets(false);
  };

  const handleApplyCategoryGroupSet = (setId: string) => {
    onApplyCategoryGroupSet(setId);
    setShowCategorySets(false);
  };

  const handleAddCategoryToMonth = (categoryId: string, allocatedAmount: number) => {
    onAddMonthlyCategory({
      id: Date.now().toString(),
      categoryId,
      monthKey: currentMonthKey,
      allocatedAmount,
    });
  };

  const handleUpdateMonthlyCategory = (monthlyCatId: string, allocatedAmount: number) => {
    const monthlyCat = monthlyBudgetCategories.find(mc => mc.id === monthlyCatId);
    if (monthlyCat) {
      onUpdateMonthlyCategory({
        ...monthlyCat,
        allocatedAmount,
      });
    }
  };

  const handleRemoveFromMonth = (monthlyCatId: string) => {
    onRemoveMonthlyCategory(monthlyCatId);
  };

  const handleUpdateTransaction = (updatedTransaction: BudgetTransaction) => {
    const originalTransaction = transactions.find(t => t.id === updatedTransaction.id);
    if (!originalTransaction) return;

    // Reverse original transaction
    const reversedAccounts = accounts.map(acc => {
      if (originalTransaction.type === "income" && acc.id === originalTransaction.accountId) {
        return { ...acc, currentBalance: acc.currentBalance - originalTransaction.amount };
      }
      if (originalTransaction.type === "expense" && acc.id === originalTransaction.accountId) {
        return { ...acc, currentBalance: acc.currentBalance + originalTransaction.amount };
      }
      if (originalTransaction.type === "transfer") {
        if (acc.id === originalTransaction.fromAccountId) {
          return { ...acc, currentBalance: acc.currentBalance + originalTransaction.amount };
        }
        if (acc.id === originalTransaction.toAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - originalTransaction.amount };
        }
      }
      if (originalTransaction.type === "credit_payment") {
        if (acc.id === originalTransaction.fromAccountId) {
          return { ...acc, currentBalance: acc.currentBalance + originalTransaction.amount };
        }
        if (acc.id === originalTransaction.toAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - originalTransaction.amount };
        }
      }
      return acc;
    });

    // Apply updated transaction
    const updatedAccounts = reversedAccounts.map(acc => {
      if (updatedTransaction.type === "income" && acc.id === updatedTransaction.accountId) {
        return { ...acc, currentBalance: acc.currentBalance + updatedTransaction.amount };
      }
      if (updatedTransaction.type === "expense" && acc.id === updatedTransaction.accountId) {
        return { ...acc, currentBalance: acc.currentBalance - updatedTransaction.amount };
      }
      if (updatedTransaction.type === "transfer") {
        if (acc.id === updatedTransaction.fromAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - updatedTransaction.amount };
        }
        if (acc.id === updatedTransaction.toAccountId) {
          return { ...acc, currentBalance: acc.currentBalance + updatedTransaction.amount };
        }
      }
      if (updatedTransaction.type === "credit_payment") {
        if (acc.id === updatedTransaction.fromAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - updatedTransaction.amount };
        }
        if (acc.id === updatedTransaction.toAccountId) {
          return { ...acc, currentBalance: acc.currentBalance + updatedTransaction.amount };
        }
      }
      return acc;
    });

    onUpdateAccounts(updatedAccounts);
    onUpdateTransaction(updatedTransaction);
    setEditingTransaction(null);
  };

  const handleDeleteTransactionWithReversal = (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    // Reverse the transaction's balance impact
    const reversedAccounts = accounts.map(acc => {
      if (transaction.type === "income" && acc.id === transaction.accountId) {
        return { ...acc, currentBalance: acc.currentBalance - transaction.amount };
      }
      if (transaction.type === "expense" && acc.id === transaction.accountId) {
        return { ...acc, currentBalance: acc.currentBalance + transaction.amount };
      }
      if (transaction.type === "transfer") {
        if (acc.id === transaction.fromAccountId) {
          return { ...acc, currentBalance: acc.currentBalance + transaction.amount };
        }
        if (acc.id === transaction.toAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - transaction.amount };
        }
      }
      if (transaction.type === "credit_payment") {
        if (acc.id === transaction.fromAccountId) {
          return { ...acc, currentBalance: acc.currentBalance + transaction.amount };
        }
        if (acc.id === transaction.toAccountId) {
          return { ...acc, currentBalance: acc.currentBalance - transaction.amount };
        }
      }
      return acc;
    });

    onUpdateAccounts(reversedAccounts);
    onDeleteTransaction(transactionId);
    setEditingTransaction(null);
    setShowTransactionDetail(null);
  };

  const flowTypeColors: Record<FlowType, { bg: string; text: string; label: string }> = {
    spending: { bg: "rgba(239,68,68,.15)", text: "#EF4444", label: "Spending" },
    saving: { bg: "rgba(16,185,129,.15)", text: "#10B981", label: "Saving" },
    investing: { bg: "rgba(99,102,241,.15)", text: "#6366F1", label: "Investing" },
    income: { bg: "rgba(5,150,105,.15)", text: "#059669", label: "Income" },
  };

  const paymentMethodIcons: Record<PaymentMethod, string> = {
    debit: "💳",
    credit: "🏦",
    cash: "💵"
  };

  // Get categories not yet added to current month
  const availableCategories = categories.filter(
    cat => !monthlyBudgetCategories.some(mc => mc.monthKey === currentMonthKey && mc.categoryId === cat.id)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with Month Navigation */}
      <div className="px-5 pt-10 pb-4 flex-shrink-0">
        <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Finance</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-slate-900 dark:text-slate-50 font-bold" style={{ fontSize: 22 }}>Budget</h1>
            <div className="flex items-center gap-2">
            {lastUpdatedFormatted && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(99,102,241,.1)" }}>
                <Clock size={10} style={{ color: "#6366F1" }} />
                <span style={{ fontSize: 9, color: "#6366F1", fontWeight: 600 }}>{lastUpdatedFormatted}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="px-4 flex-shrink-0 flex items-center justify-between mb-3">
        <button onClick={handlePrevMonth} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
          <ChevronLeft size={16} style={{ color: "#78716C" }} />
        </button>
        <div className="text-center">
          <h2 className="text-slate-900 dark:text-slate-50 font-bold" style={{ fontSize: 16 }}>
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          {lastUpdatedFormatted && (
            <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9, marginTop: 2 }}>Last Update: {lastUpdatedFormatted}</p>
          )}
        </div>
        <button onClick={handleNextMonth} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
          <ChevronRight size={16} style={{ color: "#78716C" }} />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-3" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        
        {/* ─── FINANCIAL MATRIX: INCOME VS SPENDING ──────────────────────────── */}
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-slate-900 dark:text-slate-50" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>Financial Matrix</p>
            <div className="flex items-center gap-1.5">
              {paceStatus.status === "on-track" && <CheckCircle size={14} style={{ color: paceStatus.color }} />}
              {paceStatus.status === "near" && <AlertTriangle size={14} style={{ color: paceStatus.color }} />}
              {paceStatus.status === "over" && <XCircle size={14} style={{ color: paceStatus.color }} />}
              <span className="text-xs font-bold" style={{ color: paceStatus.color }}>{paceStatus.label}</span>
            </div>
          </div>
          
          {/* Previous Surplus Carryover */}
          {financialMetrics.previousSurplus > 0 && (
            <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,.08)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRight size={12} style={{ color: "#10B981" }} />
                  <span className="text-slate-600 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 600 }}>Previous Surplus</span>
                </div>
                <span className="font-bold" style={{ color: "#10B981", fontSize: 12 }}>+${financialMetrics.previousSurplus.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Income vs Spending Visual */}
          <div className="space-y-3">
            {/* Income */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(5,150,105,.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} style={{ color: "#059669" }} />
                  <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Income</p>
                </div>
                <p className="font-bold" style={{ color: "#059669", fontSize: 18 }}>${financialMetrics.income.toFixed(2)}</p>
              </div>
              <div className="w-full h-2 rounded-full" style={{ backgroundColor: "rgba(5,150,105,.15)" }}>
                <div className="h-2 rounded-full" style={{ width: "100%", backgroundColor: "#059669" }} />
              </div>
            </div>

            {/* Spending */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(239,68,68,.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={14} style={{ color: "#EF4444" }} />
                  <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Spending</p>
                </div>
                <p className="font-bold" style={{ color: "#EF4444", fontSize: 18 }}>${financialMetrics.spending.toFixed(2)}</p>
              </div>
              <div className="w-full h-2 rounded-full" style={{ backgroundColor: "rgba(239,68,68,.15)" }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min((financialMetrics.spending / (financialMetrics.income || 1)) * 100, 100)}%`, backgroundColor: "#EF4444" }} />
              </div>
            </div>

            {/* Invest */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(99,102,241,.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Target size={14} style={{ color: "#6366F1" }} />
                  <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Invest</p>
                </div>
                <p className="font-bold" style={{ color: "#6366F1", fontSize: 18 }}>${financialMetrics.invest.toFixed(2)}</p>
              </div>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>Transferred to investment accounts</p>
            </div>

            {/* Saving */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(16,185,129,.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Shield size={14} style={{ color: "#10B981" }} />
                  <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Saving</p>
                </div>
                <p className="font-bold" style={{ color: "#10B981", fontSize: 18 }}>${financialMetrics.saving.toFixed(2)}</p>
              </div>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>(Income - Spending - Invest) + Net Savings Transfers</p>
            </div>
          </div>
          
          {/* Net Balance */}
          <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700 }}>NET BALANCE</span>
              <span className="font-bold" style={{ fontSize: 14, color: netBalance >= 0 ? "#059669" : "#EF4444" }}>${netBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Daily Rate Indicator */}
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10 }}>Daily Spending Rate</span>
            <span className="font-bold" style={{ fontSize: 12, color: "#6366F1" }}>${spendingAnalytics.current.toFixed(2)}/day</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10 }}>Projected Month Total</span>
            <span className="font-bold" style={{ fontSize: 12, color: spendingAnalytics.projected > spendingAnalytics.totalBudget ? "#EF4444" : "#059669" }}>
              ${spendingAnalytics.projected.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Credit Card Utilization Alerts */}
        {creditCardAlerts.filter(alert => alert.isOverThreshold).length > 0 && (
          <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={14} style={{ color: "#EAB308" }} />
              <p className="font-bold" style={{ fontSize: 12, color: "#EAB308" }}>Credit Utilization Alert</p>
            </div>
            {creditCardAlerts.filter(alert => alert.isOverThreshold).map(alert => (
              <div key={alert.account.id} className="flex items-center justify-between py-1">
                <span className="text-slate-700 dark:text-slate-300" style={{ fontSize: 11 }}>{alert.account.name}</span>
                <span className="font-bold" style={{ fontSize: 11, color: "#EAB308" }}>
                  {alert.utilization.toFixed(1)}% used (target: {alert.threshold}%)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Negative Balance Alerts */}
        {negativeBalanceAlerts.length > 0 && (
          <div className="rounded-2xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} style={{ color: "#EF4444" }} />
              <p className="font-bold" style={{ fontSize: 12, color: "#EF4444" }}>Negative Balance Alert</p>
            </div>
            {negativeBalanceAlerts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between py-1">
                <span className="text-slate-700 dark:text-slate-300" style={{ fontSize: 11 }}>{acc.name}</span>
                <span className="font-bold" style={{ fontSize: 11, color: "#EF4444" }}>
                  ${acc.currentBalance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Accounts Summary */}
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet size={14} style={{ color: "#2563EB" }} />
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Accounts</p>
            </div>
            <button onClick={() => setShowAccounts(true)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(37,99,235,.15)" }}>
              <Plus size={12} style={{ color: "#2563EB" }} />
            </button>
          </div>
          
          {/* Liquid Assets and Credit Used Summary */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,.08)" }}>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9, fontWeight: 600 }}>Liquid Assets</p>
              <p className="font-bold" style={{ color: "#10B981", fontSize: 12 }}>${liquidAssetsTotal.toFixed(2)}</p>
            </div>
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,.08)" }}>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9, fontWeight: 600 }}>Credit Used</p>
              <p className="font-bold" style={{ color: "#EF4444", fontSize: 12 }}>${creditUsedTotal.toFixed(2)}</p>
            </div>
          </div>
          
            {accounts.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 12 }}>No accounts yet</p>
              <button onClick={() => setShowAccounts(true)} className="mt-2 px-4 py-2 rounded-full font-bold text-xs" style={{ backgroundColor: "rgba(37,99,235,.2)", color: "#2563EB" }}>
                Add Account
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {accountBalances.slice(0, 3).map(account => {
                const isNegative = account.type !== "credit" && account.currentBalance < 0;
                return (
                  <div 
                    key={account.id} 
                    onClick={() => setSelectedAccount(account)}
                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer relative" 
                    style={{ 
                      backgroundColor: "rgba(15,23,42,.03)",
                      outline: isNegative ? "2px solid #EF4444" : "none",
                      outlineOffset: isNegative ? "2px" : "0"
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ 
                        backgroundColor: account.type === "credit" ? "#EF4444" : 
                                       account.type === "investment" ? "#6366F1" : 
                                       account.type === "hysa" ? "#10B981" : 
                                       account.type === "savings" ? "#14B8A6" : "#2563EB" 
                      }} />
                      <span className="text-slate-900 dark:text-slate-50 text-xs font-semibold">{account.name}</span>
                      {isNegative && <AlertTriangle size={12} style={{ color: "#EF4444" }} />}
                    </div>
                    <span className="text-xs font-bold" style={{ color: account.currentBalance >= 0 ? "#059669" : "#EF4444" }}>
                      ${account.currentBalance.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              {accounts.length > 3 && (
                <p className="text-slate-500 dark:text-slate-400 text-center" style={{ fontSize: 10 }}>+{accounts.length - 3} more</p>
              )}
            </div>
          )}
        </div>


        {/* Over-Spending Alerts */}
        {overspentCategories.length > 0 && (
          <div className="rounded-2xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} style={{ color: "#EF4444" }} />
              <p className="font-bold" style={{ fontSize: 12, color: "#EF4444" }}>Over Budget</p>
            </div>
            {overspentCategories.slice(0, 3).map(cat => (
              <div key={cat.monthlyId} className="flex items-center justify-between py-1">
                <span className="text-slate-700 dark:text-slate-300" style={{ fontSize: 11 }}>{cat.name}</span>
                <span className="font-bold" style={{ fontSize: 11, color: "#EF4444" }}>${cat.over.toFixed(2)} over</span>
              </div>
            ))}
          </div>
        )}

        {/* Category Budgets */}
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-slate-900 dark:text-slate-50" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={14} style={{ color: "#2563EB" }} />
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Categories</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowCategorySets(true)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(99,102,241,.15)" }}>
                <Wallet size={12} style={{ color: "#6366F1" }} />
              </button>
              <button onClick={() => setShowManageCategories(true)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(37,99,235,.15)" }}>
                <Settings size={12} style={{ color: "#2563EB" }} />
              </button>
            </div>
          </div>
          
          {currentMonthCategories.length === 0 ? (
            <div className="text-center py-6">
              <Target size={32} style={{ color: "#475569", marginBottom: 8 }} />
              <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 12 }}>No categories for this month</p>
              <button onClick={() => setShowManageCategories(true)} className="mt-2 px-4 py-2 rounded-full font-bold text-xs" style={{ backgroundColor: "rgba(37,99,235,.2)", color: "#2563EB" }}>
                Add Categories to Month
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {currentMonthCategories.map(cat => {
                const spent = getCategoryTotal(transactions, cat.id, currentMonthKey);
                const percent = Math.min((spent / cat.monthlyCap) * 100, 100);
                const isOver = spent > cat.monthlyCap;
                
                return (
                  <div key={cat.monthlyId} className="rounded-xl p-3" style={{ backgroundColor: "rgba(15,23,42,.03)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-900 dark:text-slate-50 text-sm font-semibold">{cat.name}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: isOver ? "#EF4444" : "#475569" }}>
                        ${spent.toFixed(2)} / ${cat.monthlyCap.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: "rgba(15,23,42,.06)" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: isOver ? "#EF4444" : cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Transactions */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Transactions</p>
          <button onClick={() => setShowAddTransaction(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(37,99,235,.15)" }}>
            <Plus size={12} style={{ color: "#2563EB" }} />
            <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700 }}>Add</span>
          </button>
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="text-center py-12">
            <Wallet size={48} style={{ color: "#475569", marginBottom: 12 }} />
            <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 13, marginBottom: 4 }}>No transactions yet</p>
            <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 11 }}>Start tracking your expenses and income</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTransactions.map(t => {
              const category = categories.find(c => c.id === t.categoryId);
              const account = accounts.find(a => a.id === t.accountId);
              const isExpense = t.type === "expense";
              const isTransfer = t.type === "transfer";
              const flowStyle = flowTypeColors[t.flowType];
              const fromAccount = isTransfer ? accounts.find(a => a.id === t.fromAccountId) : undefined;
              const toAccount = isTransfer ? accounts.find(a => a.id === t.toAccountId) : undefined;
              
              return (
                <div 
                  key={t.id} 
                  onClick={() => setShowTransactionDetail(t)}
                  className="rounded-2xl p-3.5 flex items-center justify-between bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-slate-900 dark:text-slate-50 cursor-pointer" 
                  style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isTransfer ? "rgba(20,184,166,.15)" : `${category?.color || "#2563EB"}20` }}>
                      {isTransfer ? (
                        <ArrowRight size={18} style={{ color: "#14B8A6" }} />
                      ) : isExpense ? (
                        <TrendingDown size={18} style={{ color: "#E11D48" }} />
                      ) : (
                        <TrendingUp size={18} style={{ color: "#059669" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-slate-50 text-sm font-semibold truncate">
                        {isTransfer 
                          ? `${fromAccount?.name || "From"} ➔ ${toAccount?.name || "To"}`
                          : (t.description || (isExpense ? "Expense" : "Income"))}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {isTransfer ? (
                          <>
                            {category && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                                <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>{category.name}</span>
                              </div>
                            )}
                            <span className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(20,184,166,.15)", color: "#14B8A6", fontSize: 8, fontWeight: 700 }}>
                              Transfer
                            </span>
                          </>
                        ) : (
                          <>
                            {category && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                                <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>{category.name}</span>
                              </div>
                            )}
                            {account && (
                              <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>
                                {paymentMethodIcons[t.paymentMethod]} {account.name}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: flowStyle.bg, color: flowStyle.text, fontSize: 8, fontWeight: 700 }}>
                              {flowStyle.label}
                            </span>
                            {t.paymentMethod === "credit" && (
                              <span className="px-1.5 py-0.5 rounded-full" style={{ 
                                backgroundColor: t.isCreditPaid ? "rgba(16,185,129,.15)" : "rgba(234,179,8,.15)",
                                color: t.isCreditPaid ? "#10B981" : "#EAB308",
                                fontSize: 8, 
                                fontWeight: 700 
                              }}>
                                {t.isCreditPaid ? "Paid" : "Unpaid"}
                              </span>
                            )}
                          </>
                        )}
                        <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>{t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold flex-shrink-0" style={{ color: isTransfer ? "#14B8A6" : isExpense ? "#E11D48" : "#059669", fontSize: 14 }}>
                      {isExpense ? "-" : ""}${t.amount.toFixed(2)}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteTransaction(t.id); }} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(239,68,68,.1)" }}>
                      <MoreHorizontal size={12} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* ─── MODALS ─────────────────────────────────────────────────────────── */}
      
      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowAddCategory(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">New Category</h3>
            <input className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" placeholder="Category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus />
            <div>
              <p className="text-stone-500 dark:text-stone-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Color</p>
              <div className="flex flex-wrap gap-2">
                {["#6366F1", "#8B5CF6", "#F43F5E", "#FB923C", "#10B981", "#38BDF8", "#F472B6", "#EF4444"].map(c => (
                  <button key={c} onClick={() => setNewCategoryColor(c)} className="w-8 h-8 rounded-full" style={{ backgroundColor: c, outline: newCategoryColor === c ? "3px solid white" : "none", outlineOffset: 2 }} />
                ))}
              </div>
            </div>
            <button onClick={handleAddCategory} className="w-full py-4 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#6366F1" }}>Add Category</button>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => { setShowAddTransaction(false); setNewTransactionStep(1); }}>
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[85vh] sm:max-h-[90vh] p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">New Transaction</h3>
            
            {/* Step 1: Transaction Type Selection */}
            {newTransactionStep === 1 && (
              <>
                <p className="text-stone-400" style={{ fontSize: 11, fontWeight: 600 }}>Step 1: Select Transaction Type</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setNewTransactionType("expense"); setNewTransactionStep(2); }}
                    className="p-4 rounded-xl text-left border-2 border-transparent hover:border-red-400/50 transition-all"
                    style={{ backgroundColor: "rgba(244,63,94,.15)" }}
                  >
                    <TrendingDown size={24} style={{ color: "#F43F5E", marginBottom: 8 }} />
                    <p className="text-white font-bold text-sm">Expense</p>
                    <p className="text-stone-400" style={{ fontSize: 10 }}>Money spent</p>
                  </button>
                  <button 
                    onClick={() => { setNewTransactionType("income"); setNewTransactionStep(2); }}
                    className="p-4 rounded-xl text-left border-2 border-transparent hover:border-emerald-400/50 transition-all"
                    style={{ backgroundColor: "rgba(16,185,129,.15)" }}
                  >
                    <TrendingUp size={24} style={{ color: "#10B981", marginBottom: 8 }} />
                    <p className="text-white font-bold text-sm">Income</p>
                    <p className="text-stone-400" style={{ fontSize: 10 }}>Money received</p>
                  </button>
                  <button 
                    onClick={() => { setNewTransactionType("transfer"); setNewTransactionStep(2); }}
                    className="p-4 rounded-xl text-left border-2 border-transparent hover:border-teal-400/50 transition-all"
                    style={{ backgroundColor: "rgba(20,184,166,.15)" }}
                  >
                    <ArrowRight size={24} style={{ color: "#14B8A6", marginBottom: 8 }} />
                    <p className="text-white font-bold text-sm">Transfer</p>
                    <p className="text-stone-400" style={{ fontSize: 10 }}>Between accounts</p>
                  </button>
                  <button 
                    onClick={() => { setNewTransactionType("credit_payment"); setNewTransactionStep(2); }}
                    className="p-4 rounded-xl text-left border-2 border-transparent hover:border-indigo-400/50 transition-all"
                    style={{ backgroundColor: "rgba(99,102,241,.15)" }}
                  >
                    <CreditCard size={24} style={{ color: "#6366F1", marginBottom: 8 }} />
                    <p className="text-white font-bold text-sm">Credit Payment</p>
                    <p className="text-stone-400" style={{ fontSize: 10 }}>Pay credit card</p>
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Type-Specific Form */}
            {newTransactionStep === 2 && (
              <>
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setNewTransactionStep(1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: "rgba(255,255,255,.06)", color: "#7878A4" }}
                  >
                    <ChevronLeft size={14} />
                    Back
                  </button>
                  <p className="text-stone-400" style={{ fontSize: 11, fontWeight: 600 }}>
                    {newTransactionType === "expense" && "Expense Details"}
                    {newTransactionType === "income" && "Income Details"}
                    {newTransactionType === "transfer" && "Transfer Details"}
                    {newTransactionType === "credit_payment" && "Credit Payment Details"}
                  </p>
                </div>

                {/* Amount and Description (common to all types) */}
                <input 
                  type="number" 
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" 
                  placeholder="Amount ($)" 
                  value={newTransactionAmount} 
                  onChange={e => setNewTransactionAmount(e.target.value)} 
                  autoFocus 
                />
                <input 
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" 
                  placeholder="Description (optional)" 
                  value={newTransactionDescription} 
                  onChange={e => setNewTransactionDescription(e.target.value)} 
                />

                {/* Income Form */}
                {newTransactionType === "income" && (
                  <>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Destination Account</p>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts
                          .filter(acc => ["checking", "savings", "hysa", "cash"].includes(acc.type))
                          .map(acc => (
                            <button 
                              key={acc.id} 
                              onClick={() => setNewTransactionAccount(acc.id)} 
                              className="py-2.5 rounded-xl text-xs font-bold"
                              style={{ 
                                backgroundColor: newTransactionAccount === acc.id ? "rgba(16,185,129,.2)" : "rgba(255,255,255,.06)", 
                                color: newTransactionAccount === acc.id ? "#10B981" : "#4E4E72" 
                              }}
                            >
                              {acc.name}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Category</p>
                      <div className="grid grid-cols-2 gap-2">
                        {currentMonthCategories.filter(cat => cat.type === "income").map(cat => (
                          <button 
                            key={cat.monthlyId} 
                            onClick={() => setNewTransactionCategory(cat.id)} 
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ 
                              backgroundColor: newTransactionCategory === cat.id ? `${cat.color}20` : "rgba(255,255,255,.06)", 
                              color: newTransactionCategory === cat.id ? cat.color : "#4E4E72" 
                            }}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Expense Form */}
                {newTransactionType === "expense" && (
                  <>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Account</p>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts.map(acc => (
                          <button 
                            key={acc.id} 
                            onClick={() => setNewTransactionAccount(acc.id)} 
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ 
                              backgroundColor: newTransactionAccount === acc.id ? "rgba(244,63,94,.2)" : "rgba(255,255,255,.06)", 
                              color: newTransactionAccount === acc.id ? "#F43F5E" : "#4E4E72" 
                            }}
                          >
                            {acc.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Category</p>
                      <div className="grid grid-cols-2 gap-2">
                        {currentMonthCategories.filter(cat => cat.type === "expense").map(cat => (
                          <button 
                            key={cat.monthlyId} 
                            onClick={() => setNewTransactionCategory(cat.id)} 
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ 
                              backgroundColor: newTransactionCategory === cat.id ? `${cat.color}20` : "rgba(255,255,255,.06)", 
                              color: newTransactionCategory === cat.id ? cat.color : "#4E4E72" 
                            }}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Transfer Form */}
                {newTransactionType === "transfer" && (
                  <>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Transfer From (Source)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts
                          .filter(acc => acc.type !== "credit")
                          .map(acc => (
                            <button 
                              key={acc.id} 
                              onClick={() => setNewTransactionFromAccount(acc.id)} 
                              className="py-2.5 rounded-xl text-xs font-bold"
                              style={{ 
                                backgroundColor: newTransactionFromAccount === acc.id ? "rgba(20,184,166,.2)" : "rgba(255,255,255,.06)", 
                                color: newTransactionFromAccount === acc.id ? "#14B8A6" : "#4E4E72",
                                opacity: newTransactionToAccount === acc.id ? 0.4 : 1
                              }}
                            >
                              {acc.name}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Transfer To (Destination)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts
                          .filter(acc => acc.type !== "credit")
                          .map(acc => (
                            <button 
                              key={acc.id} 
                              onClick={() => setNewTransactionToAccount(acc.id)} 
                              className="py-2.5 rounded-xl text-xs font-bold"
                              style={{ 
                                backgroundColor: newTransactionToAccount === acc.id ? "rgba(20,184,166,.2)" : "rgba(255,255,255,.06)", 
                                color: newTransactionToAccount === acc.id ? "#14B8A6" : "#4E4E72",
                                opacity: newTransactionFromAccount === acc.id ? 0.4 : 1
                              }}
                            >
                              {acc.name}
                            </button>
                          ))}
                      </div>
                      {newTransactionFromAccount && newTransactionToAccount && newTransactionFromAccount === newTransactionToAccount && (
                        <p className="text-red-400 mt-2" style={{ fontSize: 10, fontWeight: 600 }}>From and To accounts must be different</p>
                      )}
                    </div>

                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Tag (optional)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {currentMonthCategories.map(cat => (
                          <button 
                            key={cat.monthlyId} 
                            onClick={() => setNewTransactionCategory(cat.id)} 
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ 
                              backgroundColor: newTransactionCategory === cat.id ? `${cat.color}20` : "rgba(255,255,255,.06)", 
                              color: newTransactionCategory === cat.id ? cat.color : "#4E4E72" 
                            }}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Credit Payment Form */}
                {newTransactionType === "credit_payment" && (
                  <>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pay From (Liquid Account)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts.filter(acc => acc.type !== "credit").map(acc => (
                          <button 
                            key={acc.id} 
                            onClick={() => setNewTransactionFromAccount(acc.id)} 
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ 
                              backgroundColor: newTransactionFromAccount === acc.id ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)", 
                              color: newTransactionFromAccount === acc.id ? "#6366F1" : "#4E4E72" 
                            }}
                          >
                            {acc.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pay To (Credit Account)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts.filter(acc => acc.type === "credit").map(acc => (
                          <button 
                            key={acc.id} 
                            onClick={() => setNewTransactionToAccount(acc.id)} 
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ 
                              backgroundColor: newTransactionToAccount === acc.id ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)", 
                              color: newTransactionToAccount === acc.id ? "#6366F1" : "#4E4E72" 
                            }}
                          >
                            {acc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Date and Submit */}
                <input 
                  type="date" 
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" 
                  value={newTransactionDate} 
                  onChange={e => setNewTransactionDate(e.target.value)} 
                />
                <button 
                  onClick={handleAddTransaction} 
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm" 
                  style={{ backgroundColor: "#6366F1" }}
                >
                  Add Transaction
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {showTransactionDetail && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowTransactionDetail(null)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Transaction Details</h3>
              <button onClick={() => setShowTransactionDetail(null)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,.1)" }}>
                <X size={14} className="text-white" />
              </button>
            </div>

            {/* Transaction Info */}
            <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
              <p className="text-white font-semibold text-sm mb-2">
                {showTransactionDetail.type === "transfer" 
                  ? (() => {
                      const fromAcc = accounts.find(a => a.id === showTransactionDetail.fromAccountId);
                      const toAcc = accounts.find(a => a.id === showTransactionDetail.toAccountId);
                      return `${fromAcc?.name || "From"} ➔ ${toAcc?.name || "To"}`;
                    })()
                  : (showTransactionDetail.description || "Transaction")}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-slate-400" style={{ fontSize: 11 }}>
                  {showTransactionDetail.date}
                  {showTransactionDetail.type === "transfer" && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(20,184,166,.15)", color: "#14B8A6", fontSize: 8, fontWeight: 700 }}>
                      Transfer
                    </span>
                  )}
                </p>
                <p className="text-white font-bold" style={{ fontSize: 16 }}>
                  {showTransactionDetail.type === "expense" ? "-" : "+"}${showTransactionDetail.amount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Edit and Delete Actions */}
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setShowTransactionDetail(null);
                  setEditingTransaction(showTransactionDetail);
                }}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white"
                style={{ backgroundColor: "#6366F1" }}
              >
                Edit Transaction
              </button>
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to delete this transaction?")) {
                    handleDeleteTransactionWithReversal(showTransactionDetail.id);
                  }
                }}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
                style={{ backgroundColor: "rgba(239,68,68,.2)", color: "#EF4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {showManageCategories && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowManageCategories(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">Manage Categories - {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            
            {/* Add new category to global library */}
            <div className="space-y-2">
              <p className="text-stone-400" style={{ fontSize: 11, fontWeight: 600 }}>Create New Category</p>
              <div className="flex gap-2">
                <input 
                  className="flex-1 rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" 
                  placeholder="Category name" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  autoFocus 
                />
                <button 
                  onClick={handleAddCategory}
                  className="px-4 py-2 rounded-xl text-white font-bold text-sm"
                  style={{ backgroundColor: newCategoryName.trim() ? "#6366F1" : "rgba(99,102,241,.3)" }}
                  disabled={!newCategoryName.trim()}
                >
                  Create
                </button>
              </div>
            </div>

            {/* Available categories to add */}
            {availableCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-stone-400" style={{ fontSize: 11, fontWeight: 600 }}>Add to Month</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-white text-sm font-semibold">{cat.name}</span>
                      </div>
                      <button 
                        onClick={() => handleAddCategoryToMonth(cat.id, 0)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={{ backgroundColor: "rgba(37,99,235,.2)", color: "#2563EB" }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Currently assigned categories */}
            {currentMonthCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-stone-400" style={{ fontSize: 11, fontWeight: 600 }}>Currently Assigned</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {currentMonthCategories.map(cat => (
                    <div key={cat.monthlyId} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <div className="flex-1">
                          <p className="text-white text-sm font-semibold">{cat.name}</p>
                          <input 
                            type="number" 
                            className="mt-1 w-full rounded-lg px-2 py-1 text-stone-900 text-xs outline-none border border-stone-200 bg-white/80"
                            placeholder="Budget ($)"
                            value={cat.monthlyCap || ""}
                            onChange={e => handleUpdateMonthlyCategory(cat.monthlyId, Number(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveFromMonth(cat.monthlyId)}
                        className="w-6 h-6 rounded-full flex items-center justify-center ml-2"
                        style={{ backgroundColor: "rgba(239,68,68,.15)" }}
                      >
                        <X size={12} style={{ color: "#EF4444" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setShowManageCategories(false)} className="w-full py-3.5 rounded-2xl font-bold text-sm" style={{ backgroundColor: "rgba(255,255,255,.07)", color: "#7878A4" }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Category Group Sets Modal */}
      {showCategoryGroupSets && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowCategorySets(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">Category Group Sets</h3>
            
            {categoryGroupSets.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {categoryGroupSets.map(set => (
                  <div key={set.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">{set.name}</p>
                      <p className="text-slate-400" style={{ fontSize: 10 }}>{set.categories.length} categories</p>
                    </div>
                    <button 
                      onClick={() => handleApplyCategoryGroupSet(set.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold"
                      style={{ backgroundColor: "rgba(99,102,241,.2)", color: "#818CF8" }}
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-white/10">
              <p className="text-stone-400 mb-3" style={{ fontSize: 11, fontWeight: 600 }}>Save Current Categories as Template</p>
              <input 
                className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80 mb-3" 
                placeholder="Template name (e.g., 'Monthly Essentials')" 
                value={newGroupSetName} 
                onChange={e => setNewGroupSetName(e.target.value)} 
                autoFocus 
              />
              <button 
                onClick={handleSaveCategoryGroupSet} 
                className="w-full py-4 rounded-2xl text-white font-bold text-sm" 
                style={{ backgroundColor: currentMonthCategories.length > 0 ? "#6366F1" : "rgba(99,102,241,.3)" }}
                disabled={currentMonthCategories.length === 0}
              >
                Save Template ({currentMonthCategories.length} categories)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts Modal */}
      {showAccounts && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowAccounts(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">Manage Accounts</h3>
            
            {accounts.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {accountBalances.map(account => (
                  <div key={account.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">{account.name}</p>
                      <p className="text-slate-400" style={{ fontSize: 10, textTransform: "capitalize" }}>{account.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: account.currentBalance >= 0 ? "#10B981" : "#EF4444" }}>
                        ${account.currentBalance.toFixed(2)}
                      </span>
                      <button onClick={() => onDeleteAccount(account.id)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,.15)" }}>
                        <MoreHorizontal size={10} style={{ color: "#EF4444" }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-white/10">
              <p className="text-stone-400 mb-3" style={{ fontSize: 11, fontWeight: 600 }}>Add New Account</p>
              <input className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80 mb-2" placeholder="Account name" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} autoFocus />
              <div className="mb-2">
                <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["checking", "credit", "cash", "hysa", "investment", "savings"] as Account["type"][]).map(type => (
                    <button key={type} onClick={() => setNewAccountType(type)} className="py-2 rounded-xl text-xs font-bold capitalize" style={{ backgroundColor: newAccountType === type ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)", color: newAccountType === type ? "#6366F1" : "#4E4E72" }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <input type="number" className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80 mb-2" placeholder="Current balance ($)" value={newAccountBalance} onChange={e => setNewAccountBalance(e.target.value)} />
              {newAccountType === "credit" && (
                <input type="number" className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80 mb-3" placeholder="Credit limit ($)" value={newAccountCreditLimit} onChange={e => setNewAccountCreditLimit(e.target.value)} />
              )}
              <button onClick={handleAddAccount} className="w-full py-4 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#6366F1" }}>Add Account</button>
            </div>
          </div>
        </div>
      )}

      {/* Account Detail Modal */}
      {selectedAccount && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setSelectedAccount(null)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Account Details</h3>
              <button onClick={() => setSelectedAccount(null)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,.1)" }}>
                <X size={14} className="text-white" />
              </button>
            </div>

            {/* Account Info */}
            <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-bold text-lg">{selectedAccount.name}</p>
                  <p className="text-slate-400" style={{ fontSize: 11, textTransform: "capitalize" }}>{selectedAccount.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-lg" style={{ color: selectedAccount.currentBalance >= 0 ? "#10B981" : "#EF4444" }}>
                    ${selectedAccount.currentBalance.toFixed(2)}
                  </p>
                  {selectedAccount.type === "credit" && selectedAccount.creditLimit && (
                    <p className="text-slate-400" style={{ fontSize: 10 }}>Limit: ${selectedAccount.creditLimit.toFixed(2)}</p>
                  )}
                </div>
              </div>
              
              {/* Negative Balance Warning */}
              {selectedAccount.type !== "credit" && selectedAccount.currentBalance < 0 && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} style={{ color: "#EF4444" }} />
                    <p className="font-bold" style={{ fontSize: 11, color: "#EF4444" }}>Warning: Account balance is under $0.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Account Transactions */}
            <div>
              <p className="text-stone-400 mb-2" style={{ fontSize: 11, fontWeight: 600 }}>Transactions</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions
                  .filter(t => t.accountId === selectedAccount.id || t.fromAccountId === selectedAccount.id || t.toAccountId === selectedAccount.id)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(t => {
                    const isExpense = t.type === "expense";
                    const isTransfer = t.type === "transfer";
                    const isCreditPayment = t.type === "credit_payment";
                    
                    return (
                      <div key={t.id} className="p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">
                              {isTransfer ? `Transfer` : isCreditPayment ? `Credit Payment` : t.description || (isExpense ? "Expense" : "Income")}
                            </p>
                            <p className="text-slate-400" style={{ fontSize: 10 }}>{t.date}</p>
                          </div>
                          <span className="font-bold text-sm" style={{ color: isExpense || isTransfer || isCreditPayment ? "#EF4444" : "#10B981" }}>
                            {isExpense || isTransfer || isCreditPayment ? "-" : "+"}${t.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                {transactions.filter(t => t.accountId === selectedAccount.id || t.fromAccountId === selectedAccount.id || t.toAccountId === selectedAccount.id).length === 0 && (
                  <p className="text-slate-400 text-center py-4" style={{ fontSize: 12 }}>No transactions yet</p>
                )}
              </div>
            </div>

            {/* Edit Account Button */}
            <button 
              onClick={() => {
                const newName = prompt("Account name:", selectedAccount.name);
                if (newName && newName.trim()) {
                  onUpdateAccount({ ...selectedAccount, name: newName.trim() });
                }
              }}
              className="w-full py-3.5 rounded-2xl font-bold text-sm"
              style={{ backgroundColor: "rgba(99,102,241,.12)", color: "#818CF8", outline: "1px solid rgba(99,102,241,.25)" }}
            >
              Edit Account
            </button>
          </div>
        </div>
      )}

      {/* Transaction Edit/Delete Modal */}
      {editingTransaction && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setEditingTransaction(null)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Edit Transaction</h3>
              <button onClick={() => setEditingTransaction(null)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,.1)" }}>
                <X size={14} className="text-white" />
              </button>
            </div>

            {/* Transaction Form */}
            <div className="space-y-3">
              <div>
                <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Amount</p>
                <input 
                  type="number"
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80"
                  value={editingTransaction.amount}
                  onChange={e => setEditingTransaction({ ...editingTransaction, amount: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Description</p>
                <input 
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80"
                  value={editingTransaction.description}
                  onChange={e => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                />
              </div>
              <div>
                <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Date</p>
                <input 
                  type="date"
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80"
                  value={editingTransaction.date}
                  onChange={e => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => {
                  handleUpdateTransaction(editingTransaction);
                }}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white"
                style={{ backgroundColor: "#6366F1" }}
              >
                Save Changes
              </button>
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to delete this transaction?")) {
                    handleDeleteTransactionWithReversal(editingTransaction.id);
                  }
                }}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
                style={{ backgroundColor: "rgba(239,68,68,.2)", color: "#EF4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}