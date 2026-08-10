import { useState, useMemo } from "react";
import { 
  Wallet, Plus, TrendingUp, TrendingDown, MoreHorizontal, PieChart, 
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, 
  Calculator, TrendingUp as TrendingUpIcon, Settings, X, CreditCard,
  Receipt, Target, ArrowRight, Clock, Shield
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

export interface BudgetTransaction {
  id: string;
  categoryId: string;
  amount: number;
  description: string;
  date: string;
  type: "expense" | "income" | "transfer";
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
  outlookProjection: OutlookProjection | null;
  budgetMetadata: BudgetMetadata | null;
  surplusCarryovers: SurplusCarryover[];
  
  // Callbacks
  onAddCategory: (category: Category) => void;
  onAddMonthlyCategory: (monthlyCat: MonthlyBudgetCategory) => void;
  onUpdateMonthlyCategory: (monthlyCat: MonthlyBudgetCategory) => void;
  onRemoveMonthlyCategory: (monthlyCatId: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddTransaction: (transaction: BudgetTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransactionItem: (item: TransactionItem) => void;
  onDeleteTransactionItem: (id: string) => void;
  onAddAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
  onUpdateAccount: (account: Account) => void;
  onSaveCategoryGroupSet: (set: CategoryGroupSet) => void;
  onApplyCategoryGroupSet: (setId: string) => void;
  onUpdateOutlookProjection: (projection: OutlookProjection) => void;
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
    
    return {
      ...account,
      currentBalance: account.currentBalance + income - expenses - transfersOut + transfersIn
    };
  });
};

const calculateProjectedNetWorth = (
  accounts: Account[], 
  transactions: BudgetTransaction[], 
  years: number,
  outlook: OutlookProjection | null
) => {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  
  // Calculate average monthly surplus from last 3 months
  const now = new Date();
  const monthlySurpluses: number[] = [];
  
  for (let i = 0; i < 3; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = getMonthKey(monthDate);
    const monthTrans = getMonthTransactions(transactions, monthKey);
    const income = monthTrans.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTrans.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    monthlySurpluses.push(income - expenses);
  }
  
  const avgMonthlySurplus = monthlySurpluses.reduce((a, b) => a + b, 0) / monthlySurpluses.length;
  
  // Use custom growth rates if available
  const liquidGrowthRate = outlook ? outlook.liquidGrowthRate / 100 : 0.04;
  const investmentGrowthRate = outlook ? outlook.investmentGrowthRate / 100 : 0.08;
  
  const liquidAccounts = accounts.filter(a => a.type === "checking" || a.type === "hysa" || a.type === "cash" || a.type === "savings");
  const investmentAccounts = accounts.filter(a => a.type === "investment");
  
  const liquidBalance = liquidAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  const investmentBalance = investmentAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  
  // Future value with compound interest
  const futureLiquid = liquidBalance * Math.pow(1 + liquidGrowthRate, years) + 
                       (avgMonthlySurplus * 12 * years * (1 + liquidGrowthRate * years / 2));
  const futureInvestment = investmentBalance * Math.pow(1 + investmentGrowthRate, years) + 
                           (avgMonthlySurplus * 0.3 * 12 * years * Math.pow(1 + investmentGrowthRate, years / 2));
  
  return {
    total: futureLiquid + futureInvestment,
    liquid: futureLiquid,
    invested: futureInvestment,
    currentTotal: totalBalance
  };
};

// ─── Budget View ──────────────────────────────────────────────────────────────
export default function BudgetView({
  categories,
  monthlyBudgetCategories,
  transactions,
  accounts,
  categoryGroupSets,
  transactionItems,
  outlookProjection,
  budgetMetadata,
  surplusCarryovers,
  onAddCategory,
  onAddMonthlyCategory,
  onUpdateMonthlyCategory,
  onRemoveMonthlyCategory,
  onAddTransaction,
  onDeleteTransaction,
  onAddTransactionItem,
  onDeleteTransactionItem,
  onAddAccount,
  onDeleteAccount,
  onSaveCategoryGroupSet,
  onApplyCategoryGroupSet,
  onUpdateOutlookProjection,
}: BudgetViewProps) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showProjections, setShowProjections] = useState(false);
  const [showCategoryGroupSets, setShowCategorySets] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showTransactionDetail, setShowTransactionDetail] = useState<BudgetTransaction | null>(null);
  const [showOutlookSettings, setShowOutlookSettings] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const [newGroupSetName, setNewGroupSetName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366F1");
  
  const [newTransactionAmount, setNewTransactionAmount] = useState("");
  const [newTransactionDescription, setNewTransactionDescription] = useState("");
  const [newTransactionCategory, setNewTransactionCategory] = useState("");
  const [newTransactionType, setNewTransactionType] = useState<"expense" | "income" | "transfer">("expense");
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

  const [newTransactionItemDescription, setNewTransactionItemDescription] = useState("");
  const [newTransactionItemAmount, setNewTransactionItemAmount] = useState("");
  const [newTransactionItemFlowType, setNewTransactionItemFlowType] = useState<FlowType>("spending");

  const [outlookLiquidRate, setOutlookLiquidRate] = useState(outlookProjection?.liquidGrowthRate.toString() || "4");
  const [outlookInvestmentRate, setOutlookInvestmentRate] = useState(outlookProjection?.investmentGrowthRate.toString() || "8");

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

  // ─── 4-Pillar Financial Matrix ─────────────────────────────────────────────
  const pillarData = useMemo(() => {
    const income = monthTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = monthTransactions
      .filter(t => t.type === "expense" && t.flowType === "spending")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const savings = monthTransactions
      .filter(t => t.type === "expense" && t.flowType === "saving")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const investments = monthTransactions
      .filter(t => t.type === "expense" && t.flowType === "investing")
      .reduce((sum, t) => sum + t.amount, 0);

    // Previous surplus carryover
    const previousSurplus = surplusCarryovers
      .filter(sc => sc.toMonth === currentMonthKey && !sc.applied)
      .reduce((sum, sc) => sum + sc.amount, 0);

    return {
      income: { expected: currentMonthCategories.filter(c => c.type === "income").reduce((s, c) => s + c.monthlyCap, 0), actual: income },
      spend: { expected: currentMonthCategories.filter(c => c.type === "expense").reduce((s, c) => s + c.monthlyCap, 0), actual: expenses },
      save: { expected: 0, actual: savings },
      invest: { expected: 0, actual: investments },
      previousSurplus
    };
  }, [monthTransactions, currentMonthCategories, surplusCarryovers, currentMonthKey]);

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

  const totalAccountBalance = accountBalances.reduce((sum, acc) => sum + acc.currentBalance, 0);

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

  const [projectionYears, setProjectionYears] = useState(5);
  const projections = useMemo(() => {
    return calculateProjectedNetWorth(accountBalances, transactions, projectionYears, outlookProjection);
  }, [accountBalances, transactions, projectionYears, outlookProjection]);

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
    if (!newTransactionAmount || Number(newTransactionAmount) <= 0) return;
    
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
    } else {
      if (!newTransactionCategory || !newTransactionAccount) return;
      onAddTransaction({
        id: Date.now().toString(),
        categoryId: newTransactionCategory,
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

  const handleAddTransactionItem = () => {
    if (!showTransactionDetail || !newTransactionItemDescription || !newTransactionItemAmount) return;
    onAddTransactionItem({
      id: Date.now().toString(),
      transactionId: showTransactionDetail.id,
      description: newTransactionItemDescription,
      amount: Number(newTransactionItemAmount),
      flowType: newTransactionItemFlowType,
    });
    setNewTransactionItemDescription("");
    setNewTransactionItemAmount("");
  };

  const handleSaveOutlookSettings = () => {
    if (!outlookProjection) return;
    onUpdateOutlookProjection({
      ...outlookProjection,
      liquidGrowthRate: Number(outlookLiquidRate),
      investmentGrowthRate: Number(outlookInvestmentRate),
    });
    setShowOutlookSettings(false);
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

  // Get transaction items for selected transaction
  const selectedTransactionItems = showTransactionDetail 
    ? transactionItems.filter(ti => ti.transactionId === showTransactionDetail.id)
    : [];

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
            <button 
              onClick={() => setShowProjections(!showProjections)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(99,102,241,.15)" }}
            >
              <Calculator size={16} style={{ color: "#6366F1" }} />
            </button>
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

      {/* Projections Panel */}
      {showProjections && (
        <div className="px-4 flex-shrink-0 mb-3">
          <div className="rounded-2xl p-4 bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUpIcon size={16} style={{ color: "#6366F1" }} />
                <p className="text-slate-900 dark:text-slate-50 font-bold" style={{ fontSize: 13 }}>Wealth Projections</p>
              </div>
              <button 
                onClick={() => setShowOutlookSettings(true)}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(99,102,241,.15)" }}
              >
                <Settings size={12} style={{ color: "#6366F1" }} />
              </button>
            </div>
            
            <div className="mb-3">
              <p className="text-slate-500 dark:text-slate-400 mb-2" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Timeframe</p>
              <div className="flex gap-2">
                {[1, 3, 5, 10].map(years => (
                  <button
                    key={years}
                    onClick={() => setProjectionYears(years)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold"
                    style={{
                      backgroundColor: projectionYears === years ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)",
                      color: projectionYears === years ? "#6366F1" : "#4E4E72"
                    }}
                  >
                    {years}Y
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded-lg" style={{ backgroundColor: "rgba(15,23,42,.03)" }}>
                <span className="text-slate-600 dark:text-slate-400" style={{ fontSize: 11 }}>Current Net Worth</span>
                <span className="font-bold text-slate-900 dark:text-slate-50" style={{ fontSize: 13 }}>${projections.currentTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,.08)" }}>
                <span className="text-slate-600 dark:text-slate-400" style={{ fontSize: 11 }}>Projected ({projectionYears} years)</span>
                <span className="font-bold" style={{ color: "#10B981", fontSize: 13 }}>${projections.total.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(99,102,241,.08)" }}>
                  <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>Liquid</p>
                  <p className="font-bold" style={{ color: "#6366F1", fontSize: 12 }}>${projections.liquid.toFixed(0)}</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(5,150,105,.08)" }}>
                  <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9 }}>Invested</p>
                  <p className="font-bold" style={{ color: "#059669", fontSize: 12 }}>${projections.invested.toFixed(0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-3" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        
        {/* ─── 4-PILLAR FINANCIAL MATRIX ─────────────────────────────────────── */}
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
          {pillarData.previousSurplus > 0 && (
            <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,.08)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRight size={12} style={{ color: "#10B981" }} />
                  <span className="text-slate-600 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 600 }}>Previous Surplus</span>
                </div>
                <span className="font-bold" style={{ color: "#10B981", fontSize: 12 }}>+${pillarData.previousSurplus.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* 4 Pillars */}
          <div className="grid grid-cols-2 gap-2">
            {/* Income Pillar */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(5,150,105,.08)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={12} style={{ color: "#059669" }} />
                <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Income</p>
              </div>
              <p className="font-bold" style={{ color: "#059669", fontSize: 16 }}>${pillarData.income.actual.toFixed(2)}</p>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9, marginTop: 2 }}>of ${pillarData.income.expected.toFixed(2)} expected</p>
            </div>

            {/* Spend Pillar */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(239,68,68,.08)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown size={12} style={{ color: "#EF4444" }} />
                <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Spend</p>
              </div>
              <p className="font-bold" style={{ color: "#EF4444", fontSize: 16 }}>${pillarData.spend.actual.toFixed(2)}</p>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9, marginTop: 2 }}>of ${pillarData.spend.expected.toFixed(2)} budget</p>
            </div>

            {/* Save Pillar */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(16,185,129,.08)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Shield size={12} style={{ color: "#10B981" }} />
                <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Save</p>
              </div>
              <p className="font-bold" style={{ color: "#10B981", fontSize: 16 }}>${pillarData.save.actual.toFixed(2)}</p>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9, marginTop: 2 }}>Tax & Savings</p>
            </div>

            {/* Invest Pillar */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(99,102,241,.08)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={12} style={{ color: "#6366F1" }} />
                <p className="text-slate-600 dark:text-slate-400" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Invest</p>
              </div>
              <p className="font-bold" style={{ color: "#6366F1", fontSize: 16 }}>${pillarData.invest.actual.toFixed(2)}</p>
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 9, marginTop: 2 }}>Portfolios</p>
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

        {/* Accounts Summary */}
        <div className="rounded-2xl p-4 bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet size={14} style={{ color: "#2563EB" }} />
              <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Accounts</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900 dark:text-slate-50" style={{ fontSize: 14 }}>${totalAccountBalance.toFixed(2)}</p>
              <button onClick={() => setShowAccounts(true)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(37,99,235,.15)" }}>
                <Plus size={12} style={{ color: "#2563EB" }} />
              </button>
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
              {accountBalances.slice(0, 3).map(account => (
                <div key={account.id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: "rgba(15,23,42,.03)" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ 
                      backgroundColor: account.type === "credit" ? "#EF4444" : 
                                     account.type === "investment" ? "#6366F1" : 
                                     account.type === "hysa" ? "#10B981" : 
                                     account.type === "savings" ? "#14B8A6" : "#2563EB" 
                    }} />
                    <span className="text-slate-900 dark:text-slate-50 text-xs font-semibold">{account.name}</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: account.currentBalance >= 0 ? "#059669" : "#EF4444" }}>
                    ${account.currentBalance.toFixed(2)}
                  </span>
                </div>
              ))}
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
              <PieChart size={14} style={{ color: "#2563EB" }} />
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
              <PieChart size={32} style={{ color: "#475569", marginBottom: 8 }} />
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: isOver ? "#EF4444" : "#475569" }}>
                          ${spent.toFixed(2)} / ${cat.monthlyCap.toFixed(2)}
                        </span>
                        <button onClick={() => handleRemoveFromMonth(cat.monthlyId)} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,.1)" }}>
                          <X size={10} style={{ color: "#EF4444" }} />
                        </button>
                      </div>
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
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowAddTransaction(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">New Transaction</h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setNewTransactionType("expense")} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionType === "expense" ? "rgba(244,63,94,.2)" : "rgba(255,255,255,.06)", color: newTransactionType === "expense" ? "#F43F5E" : "#4E4E72" }}>Expense</button>
              <button onClick={() => setNewTransactionType("income")} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionType === "income" ? "rgba(16,185,129,.2)" : "rgba(255,255,255,.06)", color: newTransactionType === "income" ? "#10B981" : "#4E4E72" }}>Income</button>
              <button onClick={() => setNewTransactionType("transfer")} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionType === "transfer" ? "rgba(20,184,166,.2)" : "rgba(255,255,255,.06)", color: newTransactionType === "transfer" ? "#14B8A6" : "#4E4E72" }}>Transfer</button>
            </div>
            <input type="number" className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" placeholder="Amount ($)" value={newTransactionAmount} onChange={e => setNewTransactionAmount(e.target.value)} autoFocus />
            <input className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" placeholder="Description (optional)" value={newTransactionDescription} onChange={e => setNewTransactionDescription(e.target.value)} />
            
            {newTransactionType === "transfer" ? (
              <>
                <div>
                  <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>From Account (Source)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {accounts.map(acc => (
                      <button key={acc.id} onClick={() => setNewTransactionFromAccount(acc.id)} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionFromAccount === acc.id ? "rgba(20,184,166,.2)" : "rgba(255,255,255,.06)", color: newTransactionFromAccount === acc.id ? "#14B8A6" : "#4E4E72", opacity: newTransactionToAccount === acc.id ? 0.4 : 1 }}>
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>To Account (Destination)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {accounts.map(acc => (
                      <button key={acc.id} onClick={() => setNewTransactionToAccount(acc.id)} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionToAccount === acc.id ? "rgba(20,184,166,.2)" : "rgba(255,255,255,.06)", color: newTransactionToAccount === acc.id ? "#14B8A6" : "#4E4E72", opacity: newTransactionFromAccount === acc.id ? 0.4 : 1 }}>
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
                      <button key={cat.monthlyId} onClick={() => setNewTransactionCategory(cat.id)} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionCategory === cat.id ? `${cat.color}20` : "rgba(255,255,255,.06)", color: newTransactionCategory === cat.id ? cat.color : "#4E4E72" }}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Account</p>
                  <div className="grid grid-cols-2 gap-2">
                    {accounts.map(acc => (
                      <button key={acc.id} onClick={() => setNewTransactionAccount(acc.id)} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionAccount === acc.id ? "rgba(37,99,235,.2)" : "rgba(255,255,255,.06)", color: newTransactionAccount === acc.id ? "#2563EB" : "#4E4E72" }}>
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Payment Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["debit", "credit", "cash"] as PaymentMethod[]).map(method => (
                      <button key={method} onClick={() => setNewTransactionPaymentMethod(method)} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionPaymentMethod === method ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.06)", color: newTransactionPaymentMethod === method ? "#6366F1" : "#4E4E72" }}>
                        {method === "debit" ? "💳 Debit" : method === "credit" ? "🏦 Credit" : "💵 Cash"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Flow Type</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["spending", "saving", "investing", "income"] as FlowType[]).map(flow => (
                      <button key={flow} onClick={() => setNewTransactionFlowType(flow)} className="py-2.5 rounded-xl text-xs font-bold capitalize" style={{ backgroundColor: newTransactionFlowType === flow ? `${flowTypeColors[flow].bg}` : "rgba(255,255,255,.06)", color: newTransactionFlowType === flow ? flowTypeColors[flow].text : "#4E4E72" }}>
                        {flow}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-stone-500 dark:text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Category</p>
                  <div className="grid grid-cols-2 gap-2">
                    {currentMonthCategories.map(cat => (
                      <button key={cat.monthlyId} onClick={() => setNewTransactionCategory(cat.id)} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionCategory === cat.id ? `${cat.color}20` : "rgba(255,255,255,.06)", color: newTransactionCategory === cat.id ? cat.color : "#4E4E72" }}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <input type="date" className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" value={newTransactionDate} onChange={e => setNewTransactionDate(e.target.value)} />
            <button onClick={handleAddTransaction} className="w-full py-4 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#6366F1" }}>Add Transaction</button>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal with Itemization */}
      {showTransactionDetail && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => { setShowTransactionDetail(null); setNewTransactionItemDescription(""); setNewTransactionItemAmount(""); }}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Transaction Details</h3>
              <button onClick={() => { setShowTransactionDetail(null); setNewTransactionItemDescription(""); setNewTransactionItemAmount(""); }} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,.1)" }}>
                <X size={14} className="text-white" />
              </button>
            </div>

            {/* Transaction Info */}
            <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
              <p className="text-white font-semibold text-sm mb-1">
                {showTransactionDetail.type === "transfer" 
                  ? (() => {
                      const fromAcc = accounts.find(a => a.id === showTransactionDetail.fromAccountId);
                      const toAcc = accounts.find(a => a.id === showTransactionDetail.toAccountId);
                      return `${fromAcc?.name || "From"} ➔ ${toAcc?.name || "To"}`;
                    })()
                  : (showTransactionDetail.description || "Transaction")}
              </p>
              <p className="text-slate-400" style={{ fontSize: 11 }}>
                {showTransactionDetail.date} · ${showTransactionDetail.amount.toFixed(2)}
                {showTransactionDetail.type === "transfer" && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(20,184,166,.15)", color: "#14B8A6", fontSize: 8, fontWeight: 700 }}>
                    Transfer
                  </span>
                )}
              </p>
            </div>

            {/* Receipt Items */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Receipt size={14} style={{ color: "#6366F1" }} />
                <p className="text-stone-400" style={{ fontSize: 11, fontWeight: 600 }}>Receipt Items</p>
              </div>
              
              {selectedTransactionItems.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedTransactionItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
                      <div className="flex-1">
                        <p className="text-white text-sm">{item.description}</p>
                        <p className="text-slate-400" style={{ fontSize: 10 }}>{item.flowType}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">${item.amount.toFixed(2)}</span>
                        <button onClick={() => onDeleteTransactionItem(item.id)} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,.15)" }}>
                          <X size={10} style={{ color: "#EF4444" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Item */}
              <div className="pt-3 border-t border-white/10">
                <p className="text-stone-400 mb-2" style={{ fontSize: 10, fontWeight: 600 }}>Add Item</p>
                <input 
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80 mb-2" 
                  placeholder="Item description" 
                  value={newTransactionItemDescription}
                  onChange={e => setNewTransactionItemDescription(e.target.value)}
                />
                <input 
                  type="number"
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80 mb-2" 
                  placeholder="Amount ($)" 
                  value={newTransactionItemAmount}
                  onChange={e => setNewTransactionItemAmount(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {(["spending", "saving", "investing", "income"] as FlowType[]).map(flow => (
                    <button 
                      key={flow} 
                      onClick={() => setNewTransactionItemFlowType(flow)}
                      className="py-2 rounded-xl text-xs font-bold capitalize"
                      style={{ 
                        backgroundColor: newTransactionItemFlowType === flow ? `${flowTypeColors[flow].bg}` : "rgba(255,255,255,.06)",
                        color: newTransactionItemFlowType === flow ? flowTypeColors[flow].text : "#4E4E72"
                      }}
                    >
                      {flow}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={handleAddTransactionItem}
                  className="w-full py-3 rounded-2xl text-white font-bold text-sm"
                  style={{ backgroundColor: "#6366F1" }}
                  disabled={!newTransactionItemDescription || !newTransactionItemAmount}
                >
                  Add Item
                </button>
              </div>
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

      {/* Outlook Settings Modal */}
      {showOutlookSettings && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowOutlookSettings(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 glass-modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">Outlook Settings</h3>
            
            <div className="space-y-3">
              <div>
                <p className="text-stone-400 mb-2" style={{ fontSize: 11, fontWeight: 600 }}>Liquid Growth Rate (%)</p>
                <input 
                  type="number"
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" 
                  value={outlookLiquidRate}
                  onChange={e => setOutlookLiquidRate(e.target.value)}
                  step="0.1"
                />
                <p className="text-stone-500 mt-1" style={{ fontSize: 10 }}>Annual return for checking, savings, cash</p>
              </div>

              <div>
                <p className="text-stone-400 mb-2" style={{ fontSize: 11, fontWeight: 600 }}>Investment Growth Rate (%)</p>
                <input 
                  type="number"
                  className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" 
                  value={outlookInvestmentRate}
                  onChange={e => setOutlookInvestmentRate(e.target.value)}
                  step="0.1"
                />
                <p className="text-stone-500 mt-1" style={{ fontSize: 10 }}>Annual return for brokerage, retirement accounts</p>
              </div>
            </div>

            <button onClick={handleSaveOutlookSettings} className="w-full py-4 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#6366F1" }}>
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}