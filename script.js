let wallets = JSON.parse(localStorage.getItem('wallets')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let budgets = JSON.parse(localStorage.getItem('budgets')) || [];
let userName = localStorage.getItem('userName') || '';
let editingWalletId = null;
let editingTransactionId = null;
let editingBudgetId = null;
let deleteType = null;
let deleteId = null;

const walletsContainer = document.getElementById('wallets-container');
const noWalletsMessage = document.getElementById('no-wallets-message');
const recentTransactions = document.getElementById('recent-transactions');
const allTransactions = document.getElementById('all-transactions');
const totalBalance = document.getElementById('total-balance');
const balanceChange = document.getElementById('balance-change');

const welcomeModal = document.getElementById('welcome-modal');
const walletModal = document.getElementById('wallet-modal');
const transactionModal = document.getElementById('transaction-modal');
const budgetModal = document.getElementById('budget-modal');
const settingsModal = document.getElementById('settings-modal');
const deleteModal = document.getElementById('delete-modal');

const walletForm = document.getElementById('wallet-form');
const transactionForm = document.getElementById('transaction-form');
const budgetForm = document.getElementById('budget-form');
const welcomeForm = document.getElementById('welcome-form');

const addWalletBtn = document.getElementById('add-wallet-btn');
const addTransactionBtn = document.getElementById('add-transaction-btn');
const addBudgetBtn = document.getElementById('add-budget-btn');
const mainAddBtn = document.getElementById('main-add-btn');
const settingsBtn = document.getElementById('settings-btn');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./service-worker.js')
            .then(function (registration) {
                console.log('Service Worker registered successfully with scope:', registration.scope);
            })
            .catch(function (error) {
                console.log('Service Worker registration failed:', error);
            });
    });
} else {
    console.warn('Service Workers not supported');
}

let deferredPrompt;
const installPrompt = document.getElementById('install-prompt');
const installCancel = document.getElementById('install-cancel');
const installConfirm = document.getElementById('install-confirm');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
        installPrompt.classList.add('active');
    }, 3000);
});

installCancel.addEventListener('click', () => {
    installPrompt.classList.remove('active');
});

installConfirm.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        deferredPrompt = null;
        installPrompt.classList.remove('active');
    }
});

window.addEventListener('appinstalled', () => {
    installPrompt.classList.remove('active');
    deferredPrompt = null;
});

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function validateTransaction(transaction) {
    const errors = [];
    if (transaction.amount <= 0) errors.push("Amount must be positive");
    if (!transaction.walletId) errors.push("Wallet is required");
    if (!transaction.category) errors.push("Category is required");
    if (new Date(transaction.date) > new Date()) errors.push("Future dates not allowed");
    return errors;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.getElementById('notification-container').appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatTime(date) {
    return date.toTimeString().slice(0, 5);
}

function updateGreeting() {
    if (!userName) return;

    const hour = new Date().getHours();
    const greetingElement = document.getElementById('greeting');
    let greeting = "Good Morning";
    if (hour >= 12 && hour < 18) {
        greeting = "Good Afternoon";
    } else if (hour >= 18) {
        greeting = "Good Evening";
    }
    greetingElement.textContent = `${greeting}, ${userName}!`;
}

function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const currentDate = new Date().toLocaleDateString('en-US', options);
    document.getElementById('current-date').textContent = currentDate;
}

function getWalletIcon(type) {
    const icons = {
        cash: 'money-bill-wave',
        bank: 'university',
        card: 'credit-card',
        digital: 'mobile-alt',
        savings: 'piggy-bank'
    };
    return icons[type] || 'wallet';
}

function getCategoryIcon(category) {
    const icons = {
        food: 'utensils',
        shopping: 'shopping-bag',
        transport: 'bus',
        entertainment: 'film',
        bills: 'file-invoice-dollar',
        health: 'heartbeat',
        'smoke-drink': 'smoking'
    };
    return icons[category] || 'receipt';
}

function getCategoryName(category) {
    const names = {
        food: 'Food & Dining',
        shopping: 'Shopping',
        transport: 'Transportation',
        entertainment: 'Entertainment',
        bills: 'Bills & Utilities',
        health: 'Health & Medical',
        'smoke-drink': 'Smoke/Drink'
    };
    return names[category] || 'Other';
}

function calculateWalletBalance(walletId) {
    const walletTransactions = transactions.filter(t => t.walletId === walletId);
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) return 0;

    let balance = wallet.initialBalance || 0;
    walletTransactions.forEach(transaction => {
        if (transaction.type === 'income') {
            balance += transaction.amount;
        } else {
            balance -= transaction.amount;
        }
    });
    return balance;
}

function calculateWalletChange(walletId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const walletTransactions = transactions.filter(t =>
        t.walletId === walletId &&
        new Date(t.date) >= startOfMonth
    );

    return walletTransactions.reduce((total, transaction) => {
        if (transaction.type === 'income') {
            return total + transaction.amount;
        } else {
            return total - transaction.amount;
        }
    }, 0);
}

function renderWallets() {
    if (wallets.length === 0) {
        noWalletsMessage.style.display = 'block';
        walletsContainer.innerHTML = '';
        walletsContainer.appendChild(noWalletsMessage);
        return;
    }

    noWalletsMessage.style.display = 'none';
    let walletsHTML = '';

    wallets.forEach(wallet => {
        const currentBalance = calculateWalletBalance(wallet.id);
        const walletChange = calculateWalletChange(wallet.id);
        const changeClass = walletChange >= 0 ? 'positive' : 'negative';
        const changeIcon = walletChange >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const changeText = walletChange >= 0 ? `+${formatCurrency(Math.abs(walletChange))}` : `-${formatCurrency(Math.abs(walletChange))}`;

        walletsHTML += `
            <div class="wallet-card" data-wallet-id="${wallet.id}">
                <div class="wallet-actions">
                    <div class="wallet-action-btn edit-wallet" title="Edit Wallet">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="wallet-action-btn delete-wallet" title="Delete Wallet">
                        <i class="fas fa-trash"></i>
                    </div>
                </div>
                <div class="wallet-header">
                    <div class="wallet-icon ${wallet.type}">
                        <i class="fas fa-${getWalletIcon(wallet.type)}"></i>
                    </div>
                </div>
                <div class="wallet-name">${sanitizeInput(wallet.name)}</div>
                <div class="wallet-balance">${formatCurrency(currentBalance)}</div>
                <div class="wallet-change ${changeClass}">
                    <i class="fas ${changeIcon}"></i>
                    <span>${changeText} this month</span>
                </div>
            </div>
        `;
    });

    walletsContainer.innerHTML = walletsHTML;

    document.querySelectorAll('.edit-wallet').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const walletId = this.closest('.wallet-card').getAttribute('data-wallet-id');
            openEditWalletModal(walletId);
        });
    });

    document.querySelectorAll('.delete-wallet').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const walletId = this.closest('.wallet-card').getAttribute('data-wallet-id');
            openDeleteModal('wallet', walletId);
        });
    });

    updateTotalBalance();
}

function updateTotalBalance() {
    const total = wallets.reduce((sum, wallet) => sum + calculateWalletBalance(wallet.id), 0);
    totalBalance.textContent = formatCurrency(total);

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthTransactions = transactions.filter(t => new Date(t.date) >= lastMonth && new Date(t.date) < new Date(now.getFullYear(), now.getMonth(), 1));
    const lastMonthNet = lastMonthTransactions.reduce((total, transaction) => {
        if (transaction.type === 'income') {
            return total + transaction.amount;
        } else {
            return total - transaction.amount;
        }
    }, 0);

    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthTransactions = transactions.filter(t => new Date(t.date) >= currentMonth);
    const currentMonthNet = currentMonthTransactions.reduce((total, transaction) => {
        if (transaction.type === 'income') {
            return total + transaction.amount;
        } else {
            return total - transaction.amount;
        }
    }, 0);

    if (lastMonthNet === 0) {
        if (currentMonthNet > 0) {
            balanceChange.innerHTML = `<i class="fas fa-arrow-up"></i><span>+${formatCurrency(currentMonthNet)} from last month</span>`;
            balanceChange.className = 'balance-change positive';
        } else if (currentMonthNet < 0) {
            balanceChange.innerHTML = `<i class="fas fa-arrow-down"></i><span>-${formatCurrency(Math.abs(currentMonthNet))} from last month</span>`;
            balanceChange.className = 'balance-change negative';
        } else {
            balanceChange.innerHTML = `<i class="fas fa-minus"></i><span>No change from last month</span>`;
            balanceChange.className = 'balance-change';
        }
    } else {
        const percentageChange = ((currentMonthNet - lastMonthNet) / Math.abs(lastMonthNet)) * 100;
        if (percentageChange > 0) {
            balanceChange.innerHTML = `<i class="fas fa-arrow-up"></i><span>+${percentageChange.toFixed(1)}% from last month</span>`;
            balanceChange.className = 'balance-change positive';
        } else if (percentageChange < 0) {
            balanceChange.innerHTML = `<i class="fas fa-arrow-down"></i><span>${percentageChange.toFixed(1)}% from last month</span>`;
            balanceChange.className = 'balance-change negative';
        } else {
            balanceChange.innerHTML = `<i class="fas fa-minus"></i><span>No change from last month</span>`;
            balanceChange.className = 'balance-change';
        }
    }
}

function renderTransactionList(container, transactionsList, isRecent) {
    if (transactionsList.length === 0) {
        container.innerHTML = `
            <div class="no-wallets">
                <i class="fas fa-receipt"></i>
                <p>No transactions found.</p>
            </div>
        `;
        return;
    }

    let transactionsHTML = '';
    transactionsList.forEach(transaction => {
        const wallet = wallets.find(w => w.id === transaction.walletId);
        const walletName = wallet ? sanitizeInput(wallet.name) : 'Unknown Wallet';
        const amountClass = transaction.type === 'income' ? 'income' : 'expense';
        const amountSign = transaction.type === 'income' ? '+' : '-';
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        transactionsHTML += `
            <div class="transaction-item" data-transaction-id="${transaction.id}">
                <div class="transaction-info">
                    <div class="transaction-icon">
                        <i class="fas fa-${getCategoryIcon(transaction.category)}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${sanitizeInput(transaction.comment) || getCategoryName(transaction.category)}</h4>
                        <p>${walletName} • ${formattedDate}</p>
                        <div class="transaction-time">${transaction.time}</div>
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountSign}${formatCurrency(transaction.amount)}
                </div>
                ${!isRecent ? `
                <div class="transaction-actions">
                    <div class="transaction-action-btn edit-transaction" title="Edit Transaction">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="transaction-action-btn delete-transaction" title="Delete Transaction">
                        <i class="fas fa-trash"></i>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = transactionsHTML;

    if (!isRecent) {
        document.querySelectorAll('.edit-transaction').forEach(btn => {
            btn.addEventListener('click', function () {
                const transactionId = this.closest('.transaction-item').getAttribute('data-transaction-id');
                openEditTransactionModal(transactionId);
            });
        });

        document.querySelectorAll('.delete-transaction').forEach(btn => {
            btn.addEventListener('click', function () {
                const transactionId = this.closest('.transaction-item').getAttribute('data-transaction-id');
                openDeleteModal('transaction', transactionId);
            });
        });
    }
}

function renderTransactions() {
    const searchQuery = document.getElementById('search-transactions').value.toLowerCase();
    const filterType = document.getElementById('filter-type').value;
    const filterCategory = document.getElementById('filter-category').value;
    const filterWallet = document.getElementById('filter-wallet').value;

    let filteredTransactions = [...transactions];

    if (searchQuery) {
        filteredTransactions = filteredTransactions.filter(t =>
            t.comment?.toLowerCase().includes(searchQuery) ||
            getCategoryName(t.category).toLowerCase().includes(searchQuery) ||
            t.amount.toString().includes(searchQuery)
        );
    }

    if (filterType) {
        filteredTransactions = filteredTransactions.filter(t => t.type === filterType);
    }

    if (filterCategory) {
        filteredTransactions = filteredTransactions.filter(t => t.category === filterCategory);
    }

    if (filterWallet) {
        filteredTransactions = filteredTransactions.filter(t => t.walletId === filterWallet);
    }

    const sortedTransactions = filteredTransactions.sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateB - dateA;
    });

    const recent = sortedTransactions.slice(0, 5);
    renderTransactionList(recentTransactions, recent, true);
    renderTransactionList(allTransactions, sortedTransactions, false);

    updateWalletDropdown();
    updateFilterDropdowns();
}

function updateWalletDropdown() {
    const walletSelect = document.getElementById('transaction-wallet');
    walletSelect.innerHTML = '<option value="">Select a wallet</option>';
    wallets.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.id;
        option.textContent = sanitizeInput(wallet.name);
        walletSelect.appendChild(option);
    });
}

function updateFilterDropdowns() {
    const categorySelect = document.getElementById('filter-category');
    const walletSelect = document.getElementById('filter-wallet');

    categorySelect.innerHTML = '<option value="">All Categories</option>';
    walletSelect.innerHTML = '<option value="">All Wallets</option>';

    const categories = [...new Set(transactions.map(t => t.category))];
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = getCategoryName(category);
        categorySelect.appendChild(option);
    });

    wallets.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.id;
        option.textContent = sanitizeInput(wallet.name);
        walletSelect.appendChild(option);
    });
}

function updateAnalytics() {
    if (transactions.length === 0) {
        return;
    }

    const totalSpending = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('total-spending').textContent = formatCurrency(totalSpending);
    document.getElementById('total-income').textContent = formatCurrency(totalIncome);

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome * 100) : 0;
    document.getElementById('savings-rate').textContent = `${savingsRate.toFixed(1)}%`;

    const categorySpending = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        });

    let topCategory = '-';
    let topCategoryAmount = 0;
    for (const [category, amount] of Object.entries(categorySpending)) {
        if (amount > topCategoryAmount) {
            topCategory = getCategoryName(category);
            topCategoryAmount = amount;
        }
    }

    document.getElementById('top-category').textContent = topCategory;
    document.getElementById('top-category-amount').textContent = formatCurrency(topCategoryAmount);

    if (totalSpending > 0) {
        document.getElementById('category-chart').innerHTML = `
            <div style="text-align: center;">
                <i class="fas fa-chart-pie" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Spending by Category</p>
                <p style="font-size: 0.8rem; margin-top: 10px;">Total: ${formatCurrency(totalSpending)}</p>
            </div>
        `;
    }

    if (wallets.length > 0) {
        document.getElementById('wallet-chart').innerHTML = `
            <div style="text-align: center;">
                <i class="fas fa-chart-bar" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Wallet Distribution</p>
                <p style="font-size: 0.8rem; margin-top: 10px;">${wallets.length} wallets</p>
            </div>
        `;
    }
}

function renderBudgets() {
    const budgetsContainer = document.getElementById('budgets-container');

    if (budgets.length === 0) {
        budgetsContainer.innerHTML = `
            <div class="no-wallets">
                <i class="fas fa-chart-line"></i>
                <p>No budgets set. Create your first budget to track spending!</p>
            </div>
        `;
        return;
    }

    let budgetsHTML = '';
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    budgets.forEach(budget => {
        const spent = transactions
            .filter(t => t.type === 'expense' &&
                t.category === budget.category &&
                new Date(t.date).getMonth() === currentMonth &&
                new Date(t.date).getFullYear() === currentYear)
            .reduce((sum, t) => sum + t.amount, 0);

        const percentage = (spent / budget.amount) * 100;
        const statusClass = percentage >= 100 ? 'over-budget' : percentage >= 80 ? 'near-budget' : 'under-budget';

        budgetsHTML += `
            <div class="budget-card" data-budget-id="${budget.id}">
                <div class="budget-header">
                    <div class="budget-category">${getCategoryName(budget.category)}</div>
                    <div class="budget-actions">
                        <div class="budget-action-btn edit-budget" title="Edit Budget">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div class="budget-action-btn delete-budget" title="Delete Budget">
                            <i class="fas fa-trash"></i>
                        </div>
                    </div>
                </div>
                <div class="budget-amount">${formatCurrency(budget.amount)} / ${budget.period}</div>
                <div class="budget-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div class="progress-text">${formatCurrency(spent)} spent (${percentage.toFixed(1)}%)</div>
                </div>
            </div>
        `;
    });

    budgetsContainer.innerHTML = budgetsHTML;

    document.querySelectorAll('.edit-budget').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const budgetId = this.closest('.budget-card').getAttribute('data-budget-id');
            openEditBudgetModal(budgetId);
        });
    });

    document.querySelectorAll('.delete-budget').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const budgetId = this.closest('.budget-card').getAttribute('data-budget-id');
            openDeleteModal('budget', budgetId);
        });
    });
}

function checkBudgetAlerts() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    budgets.forEach(budget => {
        const spent = transactions
            .filter(t => t.type === 'expense' &&
                t.category === budget.category &&
                new Date(t.date).getMonth() === currentMonth &&
                new Date(t.date).getFullYear() === currentYear)
            .reduce((sum, t) => sum + t.amount, 0);

        if (spent > budget.amount * 0.8 && spent <= budget.amount) {
            showNotification(`You've spent ${(spent / budget.amount * 100).toFixed(0)}% of your ${getCategoryName(budget.category)} budget!`, 'warning');
        } else if (spent > budget.amount) {
            showNotification(`You've exceeded your ${getCategoryName(budget.category)} budget by ${formatCurrency(spent - budget.amount)}!`, 'error');
        }
    });
}

function openAddWalletModal() {
    editingWalletId = null;
    document.getElementById('wallet-modal-title').textContent = 'Add New Wallet';
    document.getElementById('wallet-form').reset();
    walletModal.classList.add('active');
}

function openEditWalletModal(walletId) {
    editingWalletId = walletId;
    const wallet = wallets.find(w => w.id === walletId);
    if (wallet) {
        document.getElementById('wallet-modal-title').textContent = 'Edit Wallet';
        document.getElementById('wallet-id').value = wallet.id;
        document.getElementById('wallet-name').value = wallet.name;
        document.getElementById('wallet-type').value = wallet.type;
        document.getElementById('initial-balance').value = wallet.initialBalance;
        walletModal.classList.add('active');
    }
}

function closeWalletModal() {
    walletModal.classList.remove('active');
}

function handleWalletFormSubmit(e) {
    e.preventDefault();

    const walletId = document.getElementById('wallet-id').value;
    const name = sanitizeInput(document.getElementById('wallet-name').value);
    const type = document.getElementById('wallet-type').value;
    const initialBalance = parseFloat(document.getElementById('initial-balance').value);

    if (initialBalance < 0) {
        showNotification('Initial balance cannot be negative', 'error');
        return;
    }

    if (editingWalletId) {
        const walletIndex = wallets.findIndex(w => w.id === editingWalletId);
        if (walletIndex !== -1) {
            wallets[walletIndex].name = name;
            wallets[walletIndex].type = type;
            wallets[walletIndex].initialBalance = initialBalance;
        }
    } else {
        const newWallet = {
            id: Date.now().toString(),
            name,
            type,
            initialBalance
        };
        wallets.push(newWallet);
    }

    saveData();
    renderWallets();
    updateWalletDropdown();
    closeWalletModal();
    showNotification('Wallet saved successfully!', 'success');
}

function openAddTransactionModal() {
    if (wallets.length === 0) {
        showNotification('Please add a wallet first before creating transactions.', 'error');
        return;
    }

    editingTransactionId = null;
    document.getElementById('transaction-modal-title').textContent = 'Add New Transaction';
    document.getElementById('transaction-form').reset();
    document.getElementById('transaction-date').valueAsDate = new Date();
    document.getElementById('transaction-time').value = formatTime(new Date());

    document.querySelectorAll('.category-item').forEach(item => item.classList.remove('selected'));
    document.getElementById('transaction-category').value = '';

    transactionModal.classList.add('active');
}

function openEditTransactionModal(transactionId) {
    editingTransactionId = transactionId;
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
        document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
        document.getElementById('transaction-id').value = transaction.id;
        document.getElementById('transaction-type').value = transaction.type;
        document.getElementById('transaction-amount').value = transaction.amount;
        document.getElementById('transaction-wallet').value = transaction.walletId;
        document.getElementById('transaction-date').value = transaction.date;
        document.getElementById('transaction-time').value = transaction.time;
        document.getElementById('transaction-comment').value = transaction.comment || '';

        document.querySelectorAll('.category-item').forEach(item => {
            if (item.getAttribute('data-category') === transaction.category) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        document.getElementById('transaction-category').value = transaction.category;

        transactionModal.classList.add('active');
    }
}

function closeTransactionModal() {
    transactionModal.classList.remove('active');
}

function handleTransactionFormSubmit(e) {
    e.preventDefault();

    if (!document.getElementById('transaction-category').value) {
        showNotification('Please select a category', 'error');
        return;
    }

    const transactionId = document.getElementById('transaction-id').value;
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const walletId = document.getElementById('transaction-wallet').value;
    const category = document.getElementById('transaction-category').value;
    const date = document.getElementById('transaction-date').value;
    const time = document.getElementById('transaction-time').value;
    const comment = sanitizeInput(document.getElementById('transaction-comment').value);

    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) {
        showNotification('Selected wallet not found', 'error');
        return;
    }

    const transaction = { type, amount, walletId, category, date, time, comment };
    const errors = validateTransaction(transaction);
    if (errors.length > 0) {
        showNotification(errors[0], 'error');
        return;
    }

    if (editingTransactionId) {
        const transactionIndex = transactions.findIndex(t => t.id === editingTransactionId);
        if (transactionIndex !== -1) {
            transactions[transactionIndex] = {
                ...transactions[transactionIndex],
                type,
                amount,
                walletId,
                category,
                date,
                time,
                comment
            };
        }
    } else {
        const newTransaction = {
            id: Date.now().toString(),
            type,
            amount,
            walletId,
            category,
            date,
            time,
            comment
        };
        transactions.push(newTransaction);
    }

    saveData();
    renderWallets();
    renderTransactions();
    updateAnalytics();
    checkBudgetAlerts();
    closeTransactionModal();
    showNotification('Transaction saved successfully!', 'success');
}

function openAddBudgetModal() {
    editingBudgetId = null;
    document.getElementById('budget-modal-title').textContent = 'Add New Budget';
    document.getElementById('budget-form').reset();
    budgetModal.classList.add('active');
}

function openEditBudgetModal(budgetId) {
    editingBudgetId = budgetId;
    const budget = budgets.find(b => b.id === budgetId);
    if (budget) {
        document.getElementById('budget-modal-title').textContent = 'Edit Budget';
        document.getElementById('budget-id').value = budget.id;
        document.getElementById('budget-category').value = budget.category;
        document.getElementById('budget-amount').value = budget.amount;
        document.getElementById('budget-period').value = budget.period;
        budgetModal.classList.add('active');
    }
}

function closeBudgetModal() {
    budgetModal.classList.remove('active');
}

function handleBudgetFormSubmit(e) {
    e.preventDefault();

    const budgetId = document.getElementById('budget-id').value;
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);
    const period = document.getElementById('budget-period').value;

    if (amount <= 0) {
        showNotification('Budget amount must be positive', 'error');
        return;
    }

    const existingBudget = budgets.find(b => b.category === category && b.id !== budgetId);
    if (existingBudget) {
        showNotification('Budget for this category already exists', 'error');
        return;
    }

    if (editingBudgetId) {
        const budgetIndex = budgets.findIndex(b => b.id === editingBudgetId);
        if (budgetIndex !== -1) {
            budgets[budgetIndex] = {
                ...budgets[budgetIndex],
                category,
                amount,
                period
            };
        }
    } else {
        const newBudget = {
            id: Date.now().toString(),
            category,
            amount,
            period,
            createdAt: new Date().toISOString()
        };
        budgets.push(newBudget);
    }

    saveData();
    renderBudgets();
    closeBudgetModal();
    showNotification('Budget saved successfully!', 'success');
}

function openSettingsModal() {
    document.getElementById('settings-user-name').value = userName;
    settingsModal.classList.add('active');
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

function openDeleteModal(type, id) {
    deleteType = type;
    deleteId = id;
    let message = '';

    if (type === 'wallet') {
        const wallet = wallets.find(w => w.id === id);
        message = `Are you sure you want to delete the wallet "${wallet.name}"? This will also delete all transactions associated with this wallet.`;
    } else if (type === 'transaction') {
        message = 'Are you sure you want to delete this transaction?';
    } else if (type === 'budget') {
        const budget = budgets.find(b => b.id === id);
        message = `Are you sure you want to delete the budget for ${getCategoryName(budget.category)}?`;
    }

    document.getElementById('delete-message').textContent = message;
    deleteModal.classList.add('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
}

function confirmDelete() {
    if (deleteType === 'wallet') {
        wallets = wallets.filter(w => w.id !== deleteId);
        transactions = transactions.filter(t => t.walletId !== deleteId);
    } else if (deleteType === 'transaction') {
        transactions = transactions.filter(t => t.id !== deleteId);
    } else if (deleteType === 'budget') {
        budgets = budgets.filter(b => b.id !== deleteId);
    }

    saveData();
    renderWallets();
    renderTransactions();
    renderBudgets();
    updateAnalytics();
    closeDeleteModal();
    showNotification('Item deleted successfully!', 'success');
}

function handleMainAddButton() {
    const activeSection = document.querySelector('.section.active').id;
    if (activeSection === 'wallets-section') {
        openAddWalletModal();
    } else if (activeSection === 'transactions-section') {
        openAddTransactionModal();
    } else if (activeSection === 'budgets-section') {
        openAddBudgetModal();
    } else {
        openAddTransactionModal();
    }
}

function saveData() {
    try {
        localStorage.setItem('wallets', JSON.stringify(wallets));
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('budgets', JSON.stringify(budgets));
        localStorage.setItem('userName', userName);
    } catch (error) {
        console.error('Storage error:', error);
        showNotification('Failed to save data. Storage might be full.', 'error');
    }
}

function exportData() {
    const data = {
        wallets,
        transactions,
        budgets,
        userName,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintrack-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Data exported successfully!', 'success');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm('This will replace all current data. Continue?')) {
                wallets = data.wallets || [];
                transactions = data.transactions || [];
                budgets = data.budgets || [];
                userName = data.userName || '';
                saveData();
                initializeApp();
                showNotification('Data imported successfully!', 'success');
            }
        } catch (error) {
            showNotification('Invalid backup file', 'error');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('This will permanently delete all your data. This action cannot be undone. Continue?')) {
        wallets = [];
        transactions = [];
        budgets = [];
        saveData();
        initializeApp();
        showNotification('All data cleared successfully!', 'success');
    }
}

function initializeApp() {
    if (!userName) {
        welcomeModal.classList.add('active');
    } else {
        welcomeModal.classList.remove('active');
        updateGreeting();
    }

    updateDate();
    renderWallets();
    renderTransactions();
    renderBudgets();
    updateAnalytics();
    checkBudgetAlerts();

    const now = new Date();
    document.getElementById('transaction-date').valueAsDate = now;
    document.getElementById('transaction-time').value = formatTime(now);

    addWalletBtn.addEventListener('click', openAddWalletModal);
    addTransactionBtn.addEventListener('click', openAddTransactionModal);
    addBudgetBtn.addEventListener('click', openAddBudgetModal);
    mainAddBtn.addEventListener('click', handleMainAddButton);
    settingsBtn.addEventListener('click', openSettingsModal);

    walletForm.addEventListener('submit', handleWalletFormSubmit);
    transactionForm.addEventListener('submit', handleTransactionFormSubmit);
    budgetForm.addEventListener('submit', handleBudgetFormSubmit);
    welcomeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        userName = sanitizeInput(document.getElementById('user-name').value);
        if (userName) {
            localStorage.setItem('userName', userName);
            welcomeModal.classList.remove('active');
            updateGreeting();
            showNotification(`Welcome to FinTrack, ${userName}!`, 'success');
        }
    });

    document.getElementById('close-wallet-modal').addEventListener('click', closeWalletModal);
    document.getElementById('close-transaction-modal').addEventListener('click', closeTransactionModal);
    document.getElementById('close-budget-modal').addEventListener('click', closeBudgetModal);
    document.getElementById('close-settings-modal').addEventListener('click', closeSettingsModal);
    document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);

    document.getElementById('cancel-wallet').addEventListener('click', closeWalletModal);
    document.getElementById('cancel-transaction').addEventListener('click', closeTransactionModal);
    document.getElementById('cancel-budget').addEventListener('click', closeBudgetModal);
    document.getElementById('cancel-delete').addEventListener('click', closeDeleteModal);

    document.getElementById('confirm-delete').addEventListener('click', confirmDelete);

    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('transaction-category').value = this.getAttribute('data-category');
        });
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.remove('active');
            });
            this.classList.add('active');

            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });

            const sectionId = this.getAttribute('data-section');
            if (sectionId) {
                document.getElementById(sectionId).classList.add('active');
            }
        });
    });

    document.getElementById('view-all-transactions').addEventListener('click', function () {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector('[data-section="transactions-section"]').classList.add('active');
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.getElementById('transactions-section').classList.add('active');
    });

    document.getElementById('search-transactions').addEventListener('input', renderTransactions);
    document.getElementById('filter-type').addEventListener('change', renderTransactions);
    document.getElementById('filter-category').addEventListener('change', renderTransactions);
    document.getElementById('filter-wallet').addEventListener('change', renderTransactions);

    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', function () {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', function (e) {
        if (e.target.files[0]) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });
    document.getElementById('clear-data').addEventListener('click', clearAllData);
    document.getElementById('save-settings').addEventListener('click', function () {
        const newUserName = sanitizeInput(document.getElementById('settings-user-name').value);
        if (newUserName && newUserName !== userName) {
            userName = newUserName;
            localStorage.setItem('userName', userName);
            updateGreeting();
            showNotification('Settings saved successfully!', 'success');
        }
        closeSettingsModal();
    });

    console.log('FinTrack app initialized successfully.');
}
document.addEventListener('DOMContentLoaded', initializeApp);