import { useState, useEffect } from "react";
import { Wallet, Plus, TrendingUp, TrendingDown, MoreHorizontal, PieChart } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  monthlyCap: number;
}

export interface BudgetTransaction {
  id: string;
  categoryId: string;
  amount: number;
  description: string;
  date: string;
  type: "expense" | "income";
}

interface BudgetViewProps {
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  onAddCategory: (category: BudgetCategory) => void;
  onAddTransaction: (transaction: BudgetTransaction) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthTransactions = (transactions: BudgetTransaction[], month: string) => {
  return transactions.filter(t => t.date.startsWith(month));
};

const getCategoryTotal = (transactions: BudgetTransaction[], categoryId: string, month: string) => {
  return getMonthTransactions(transactions, month)
    .filter(t => t.categoryId === categoryId && t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
};

// ─── Budget View ─────────────────────────────────────────────────────────────
export default function BudgetView({
  categories,
  transactions,
  onAddCategory,
  onAddTransaction,
  onDeleteCategory,
  onDeleteTransaction,
}: BudgetViewProps) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentMonth] = useState(getCurrentMonth());

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366F1");
  const [newCategoryCap, setNewCategoryCap] = useState("");

  const [newTransactionAmount, setNewTransactionAmount] = useState("");
  const [newTransactionDescription, setNewTransactionDescription] = useState("");
  const [newTransactionCategory, setNewTransactionCategory] = useState("");
  const [newTransactionType, setNewTransactionType] = useState<"expense" | "income">("expense");
  const [newTransactionDate, setNewTransactionDate] = useState(new Date().toISOString().split("T")[0]);

  const monthTransactions = getMonthTransactions(transactions, currentMonth);
  const totalExpenses = monthTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = monthTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  const displayedTransactions = selectedCategory === "all" 
    ? monthTransactions 
    : monthTransactions.filter(t => t.categoryId === selectedCategory);

  const sortedTransactions = [...displayedTransactions].sort((a, b) => 
    b.date.localeCompare(a.date)
  );

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !newCategoryCap) return;
    onAddCategory({
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
      monthlyCap: Number(newCategoryCap),
    });
    setNewCategoryName("");
    setNewCategoryCap("");
    setShowAddCategory(false);
  };

  const handleAddTransaction = () => {
    if (!newTransactionAmount || !newTransactionCategory) return;
    onAddTransaction({
      id: Date.now().toString(),
      categoryId: newTransactionCategory,
      amount: Number(newTransactionAmount),
      description: newTransactionDescription,
      date: newTransactionDate,
      type: newTransactionType,
    });
    setNewTransactionAmount("");
    setNewTransactionDescription("");
    setNewTransactionCategory("");
    setNewTransactionType("expense");
    setShowAddTransaction(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-10 pb-4 flex-shrink-0">
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>Finance</p>
        <h1 className="text-stone-900 font-bold" style={{ fontSize: 22 }}>Budget</h1>
      </div>

      {/* Monthly Summary */}
      <div className="px-4 flex-shrink-0 space-y-3">
        <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.6)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#78716C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>This Month</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p style={{ fontSize: 9, color: "#78716C", marginBottom: 2 }}>Income</p>
              <p className="font-bold" style={{ color: "#10B981", fontSize: 16 }}>${totalIncome.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: "#78716C", marginBottom: 2 }}>Expenses</p>
              <p className="font-bold" style={{ color: "#F43F5E", fontSize: 16 }}>${totalExpenses.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: "#78716C", marginBottom: 2 }}>Balance</p>
              <p className="font-bold" style={{ color: netBalance >= 0 ? "#6366F1" : "#EF4444", fontSize: 16 }}>${netBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Category Budgets */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.6)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChart size={14} style={{ color: "#6366F1" }} />
              <p style={{ fontSize: 10, fontWeight: 700, color: "#78716C", letterSpacing: "0.08em", textTransform: "uppercase" }}>Categories</p>
            </div>
            <button onClick={() => setShowAddCategory(true)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(99,102,241,.15)" }}>
              <Plus size={12} style={{ color: "#6366F1" }} />
            </button>
          </div>
          
          {categories.length === 0 ? (
            <div className="text-center py-6">
              <Wallet size={32} style={{ color: "#3A3A5A", marginBottom: 8 }} />
              <p style={{ fontSize: 12, color: "#3A3A5A" }}>No categories yet</p>
              <button onClick={() => setShowAddCategory(true)} className="mt-2 px-4 py-2 rounded-full font-bold text-xs" style={{ backgroundColor: "rgba(99,102,241,.2)", color: "#6366F1" }}>
                Add Category
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => {
                const spent = getCategoryTotal(transactions, cat.id, currentMonth);
                const percent = Math.min((spent / cat.monthlyCap) * 100, 100);
                const isOver = spent > cat.monthlyCap;
                
                return (
                  <div key={cat.id} className="rounded-xl p-3" style={{ backgroundColor: "rgba(0,0,0,.03)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-semibold" style={{ color: "#1C1917" }}>{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: isOver ? "#EF4444" : "#78716C" }}>
                          ${spent.toFixed(2)} / ${cat.monthlyCap.toFixed(2)}
                        </span>
                        <button onClick={() => onDeleteCategory(cat.id)} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,.1)" }}>
                          <MoreHorizontal size={10} style={{ color: "#EF4444" }} />
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: "rgba(0,0,0,.06)" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: isOver ? "#EF4444" : cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 mt-3" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#78716C" }}>Transactions</p>
          <button onClick={() => setShowAddTransaction(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(99,102,241,.15)" }}>
            <Plus size={12} style={{ color: "#6366F1" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#6366F1" }}>Add</span>
          </button>
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="text-center py-12">
            <Wallet size={48} style={{ color: "#3A3A5A", marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: "#3A3A5A", marginBottom: 4 }}>No transactions yet</p>
            <p style={{ fontSize: 11, color: "#78716C" }}>Start tracking your expenses and income</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTransactions.map(t => {
              const category = categories.find(c => c.id === t.categoryId);
              const isExpense = t.type === "expense";
              
              return (
                <div key={t.id} className="rounded-2xl p-3.5 flex items-center justify-between" style={{ backgroundColor: "rgba(255,255,255,.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.6)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${category?.color || "#6366F1"}20` }}>
                      {isExpense ? (
                        <TrendingDown size={18} style={{ color: "#F43F5E" }} />
                      ) : (
                        <TrendingUp size={18} style={{ color: "#10B981" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#1C1917" }}>{t.description || (isExpense ? "Expense" : "Income")}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {category && (
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                            <span style={{ fontSize: 9, color: "#78716C" }}>{category.name}</span>
                          </div>
                        )}
                        <span style={{ fontSize: 9, color: "#78716C" }}>{t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold flex-shrink-0" style={{ color: isExpense ? "#F43F5E" : "#10B981", fontSize: 14 }}>
                      {isExpense ? "-" : "+"}${t.amount.toFixed(2)}
                    </span>
                    <button onClick={() => onDeleteTransaction(t.id)} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(239,68,68,.1)" }}>
                      <MoreHorizontal size={12} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowAddCategory(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4" style={{ backgroundColor: "#1C1917" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">New Category</h3>
            <input className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" placeholder="Category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus />
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#78716C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Color</p>
              <div className="flex flex-wrap gap-2">
                {["#6366F1", "#8B5CF6", "#F43F5E", "#FB923C", "#10B981", "#38BDF8", "#F472B6", "#EF4444"].map(c => (
                  <button key={c} onClick={() => setNewCategoryColor(c)} className="w-8 h-8 rounded-full" style={{ backgroundColor: c, outline: newCategoryColor === c ? "3px solid white" : "none", outlineOffset: 2 }} />
                ))}
              </div>
            </div>
            <input type="number" className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" placeholder="Monthly cap ($)" value={newCategoryCap} onChange={e => setNewCategoryCap(e.target.value)} />
            <button onClick={handleAddCategory} className="w-full py-4 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#6366F1" }}>Add Category</button>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }} onClick={() => setShowAddTransaction(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4" style={{ backgroundColor: "#1C1917" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.2)" }} />
            </div>
            <h3 className="text-white font-bold text-base">New Transaction</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setNewTransactionType("expense")} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionType === "expense" ? "rgba(244,63,94,.2)" : "rgba(255,255,255,.06)", color: newTransactionType === "expense" ? "#F43F5E" : "#4E4E72" }}>Expense</button>
              <button onClick={() => setNewTransactionType("income")} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionType === "income" ? "rgba(16,185,129,.2)" : "rgba(255,255,255,.06)", color: newTransactionType === "income" ? "#10B981" : "#4E4E72" }}>Income</button>
            </div>
            <input type="number" className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" placeholder="Amount ($)" value={newTransactionAmount} onChange={e => setNewTransactionAmount(e.target.value)} autoFocus />
            <input className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" placeholder="Description (optional)" value={newTransactionDescription} onChange={e => setNewTransactionDescription(e.target.value)} />
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#78716C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Category</p>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setNewTransactionCategory(cat.id)} className="py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: newTransactionCategory === cat.id ? `${cat.color}20` : "rgba(255,255,255,.06)", color: newTransactionCategory === cat.id ? cat.color : "#4E4E72" }}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <input type="date" className="w-full rounded-xl px-4 py-3 text-stone-900 text-sm outline-none border border-stone-200 bg-white/80" value={newTransactionDate} onChange={e => setNewTransactionDate(e.target.value)} />
            <button onClick={handleAddTransaction} className="w-full py-4 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#6366F1" }}>Add Transaction</button>
          </div>
        </div>
      )}
    </div>
  );
}