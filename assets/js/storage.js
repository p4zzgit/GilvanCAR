import { db } from './firebase-init.js';
import { 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    deleteDoc,
    query,
    where,
    writeBatch
} from 'firebase/firestore';

/**
 * Módulo de persistência de dados usando LocalStorage com sincronização Firebase
 */
const Storage = {
    isSyncing: false,
    
    // Chaves de armazenamento
    KEYS: {
        CLIENTS: 'gestao_pro_clients',
        SERVICES: 'gestao_pro_services',
        PRODUCTS: 'gestao_pro_products',
        BUDGETS: 'gestao_pro_budgets',
        RECEIPTS: 'gestao_pro_receipts',
        FINANCE: 'gestao_pro_finance',
        AGENDA: 'gestao_pro_agenda',
        SETTINGS: 'gestao_pro_settings',
        AUTH: 'gestao_pro_auth',
        USERS: 'gestao_pro_users',
        REMEMBERED_USER: 'gestao_pro_remembered',
        ORDERS: 'gestao_pro_orders',
        MOVEMENTS: 'gestao_pro_movements',
        CATEGORIES: 'gestao_pro_categories',
        COUNTERS: 'gestao_pro_counters'
    },

    // Mapeamento para coleções Firebase
    COLLECTIONS: {
        'gestao_pro_clients': 'clients',
        'gestao_pro_services': 'services',
        'gestao_pro_products': 'products',
        'gestao_pro_budgets': 'budgets',
        'gestao_pro_receipts': 'receipts',
        'gestao_pro_finance': 'finance',
        'gestao_pro_agenda': 'agenda',
        'gestao_pro_settings': 'settings',
        'gestao_pro_users': 'users',
        'gestao_pro_orders': 'orders',
        'gestao_pro_movements': 'movements',
        'gestao_pro_categories': 'categories',
        'gestao_pro_counters': 'counters'
    },

    // Inicializar e sincronizar com Firebase
    async init() {
        console.log('Iniciando sincronização com Firebase...');
        this.isSyncing = true;
        try {
            const auth = localStorage.getItem(this.KEYS.AUTH);
            let keysToSync;

            if (auth) {
                // Usuário logado: Sincroniza tudo
                keysToSync = Object.keys(this.COLLECTIONS);
            } else {
                // Visitante público: Sincroniza apenas o necessário para a Loja/Orçamentos
                keysToSync = [
                    this.KEYS.SETTINGS,
                    this.KEYS.PRODUCTS,
                    this.KEYS.SERVICES,
                    this.KEYS.CATEGORIES,
                    this.KEYS.BUDGETS, // Necessário para ver orçamentos públicos
                    this.KEYS.COUNTERS // Necessário para gerar IDs se permitido
                ];
            }

            const syncPromises = keysToSync.map(key => this.syncFromFirebase(key));
            await Promise.all(syncPromises);
            
            console.log('Sincronização concluída!');
            this.isSyncing = false;
            return true;
        } catch (error) {
            console.error('Erro na sincronização inicial:', error);
            this.isSyncing = false;
            return false;
        }
    },

    // Buscar dados do Firebase e salvar no LocalStorage
    async syncFromFirebase(key) {
        const collectionName = this.COLLECTIONS[key];
        if (!collectionName) return;

        try {
            console.log(`Sincronizando ${collectionName}...`);
            
            // Timeout de 60 segundos para não travar a inicialização
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout ao carregar ${collectionName} (60s)`)), 60000)
            );
            
            const fetchPromise = getDocs(collection(db, collectionName));
            const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);
            
            console.log(`${collectionName} OK! Itens: ${querySnapshot.size}`);
            let data;

            // Tratamento especial para settings e counters (objetos únicos)
            if (key === this.KEYS.SETTINGS || key === this.KEYS.COUNTERS) {
                data = null;
                querySnapshot.forEach((doc) => {
                    data = doc.data();
                });
                if (!data) return;
            } else {
                data = [];
                querySnapshot.forEach((doc) => {
                    data.push({ ...doc.data(), id: doc.id });
                });
            }

            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`Erro ao sincronizar ${collectionName}:`, error);
        }
    },

    // Remover item do LocalStorage e Firebase
    async removeItem(key, id) {
        const collectionName = this.COLLECTIONS[key];
        let data = this.get(key);
        
        if (Array.isArray(data)) {
            data = data.filter(item => item.id !== id);
            localStorage.setItem(key, JSON.stringify(data));
            
            if (collectionName) {
                try {
                    await deleteDoc(doc(db, collectionName, String(id)));
                } catch (error) {
                    console.error(`Erro ao deletar de ${collectionName}:`, error);
                }
            }
        }
    },

    // Salvar dados no LocalStorage e Firebase
    async save(key, data) {
        // Salvar localmente primeiro para resposta rápida
        localStorage.setItem(key, JSON.stringify(data));

        const collectionName = this.COLLECTIONS[key];
        if (!collectionName) return;

        try {
            if (key === this.KEYS.SETTINGS || key === this.KEYS.COUNTERS) {
                // Objeto único
                await setDoc(doc(db, collectionName, 'main'), data);
            } else if (Array.isArray(data)) {
                // Para coleções, o save (sobrescrever tudo) é perigoso se não houver rastreio de deletes
                // Por enquanto, vamos apenas garantir que o saveItem e removeItem sejam usados para operações granulares
                // Mas se for necessário salvar a lista toda:
                for (const item of data) {
                    if (item.id) {
                        await setDoc(doc(db, collectionName, String(item.id)), item);
                    }
                }
            }
        } catch (error) {
            console.error(`Erro ao salvar ${collectionName} no Firebase:`, error);
        }
    },

    // Buscar dados (Síncrono do LocalStorage - Mirror)
    async testConnection() {
        if (!this.db) throw new Error('Firebase não inicializado.');
        try {
            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const testRef = doc(this.db, '_health_check', 'ping');
            await getDoc(testRef);
            return true;
        } catch (err) {
            console.error('Erro no teste de conexão:', err);
            throw err;
        }
    },

    get(key) {
        const data = localStorage.getItem(key);
        if (key === this.KEYS.SETTINGS) {
            return data ? JSON.parse(data) : this.getDefaultSettings();
        }
        if (key === this.KEYS.COUNTERS) {
            return data ? JSON.parse(data) : { OS: 0, ORC: 0, PED: 0 };
        }
        if (key === this.KEYS.AUTH) {
            return data ? JSON.parse(data) : null;
        }
        if (key === this.KEYS.USERS && (!data || JSON.parse(data).length === 0)) {
            return this.getDefaultUsers();
        }
        return data ? JSON.parse(data) : [];
    },

    getDefaultSettings() {
        return {
            companyName: 'Minha Empresa',
            logo: '',
            address: '',
            phone: '',
            whatsapp: '',
            cnpj: '',
            primaryColor: '#3b82f6',
            theme: 'dark',
            storeActive: true,
            storeShowPrices: true
        };
    },

    getDefaultUsers() {
        return [{
            id: 'admin',
            name: 'Administrador Principal',
            user: 'admin',
            pass: 'admin',
            role: 'Administrador',
            status: 'Ativo',
            permissions: {
                clientes: true,
                produtos: true,
                servicos: true,
                orcamentos: true,
                financeiro: true,
                relatorios: true,
                gestao_usuarios: true,
                configuracoes: true
            }
        }];
    },

    // Get next sequential number
    async getNextNumber(type) {
        let counters = localStorage.getItem(this.KEYS.COUNTERS);
        counters = counters ? JSON.parse(counters) : { OS: 0, ORC: 0, PED: 0 };
        
        counters[type] = (counters[type] || 0) + 1;
        await this.save(this.KEYS.COUNTERS, counters);
        
        const num = counters[type].toString().padStart(5, '0');
        return num;
    },

    // Salvar item individual no Firebase sem sobrescrever toda a coleção
    async saveItem(key, item) {
        // Atualizar LocalStorage
        let data = this.get(key);
        
        const collectionKeys = [
            this.KEYS.CLIENTS, this.KEYS.SERVICES, this.KEYS.PRODUCTS, 
            this.KEYS.BUDGETS, this.KEYS.RECEIPTS, this.KEYS.FINANCE, 
            this.KEYS.AGENDA, this.KEYS.USERS, this.KEYS.ORDERS, 
            this.KEYS.MOVEMENTS, this.KEYS.CATEGORIES
        ];

        if (collectionKeys.includes(key) || Array.isArray(data)) {
            if (!Array.isArray(data)) data = [];
            const index = data.findIndex(i => i.id === item.id);
            if (index > -1) {
                data[index] = item;
            } else {
                data.push(item);
            }
            localStorage.setItem(key, JSON.stringify(data));
        } else {
            // Se for objeto único (settings/counters)
            localStorage.setItem(key, JSON.stringify(item));
        }

        const collectionName = this.COLLECTIONS[key];
        if (!collectionName) return;

        try {
            if (key === this.KEYS.SETTINGS || key === this.KEYS.COUNTERS) {
                await setDoc(doc(db, collectionName, 'main'), item);
            } else {
                if (item.id) {
                    await setDoc(doc(db, collectionName, String(item.id)), item);
                }
            }
        } catch (error) {
            console.error(`Erro ao salvar item em ${collectionName}:`, error);
            throw error;
        }
    },

    // Métodos específicos para facilitar
    getClients() { return this.get(this.KEYS.CLIENTS); },
    saveClients(data) { this.save(this.KEYS.CLIENTS, data); },

    getServices() { return this.get(this.KEYS.SERVICES); },
    saveServices(data) { this.save(this.KEYS.SERVICES, data); },

    getProducts() { return this.get(this.KEYS.PRODUCTS); },
    saveProducts(data) { this.save(this.KEYS.PRODUCTS, data); },

    getBudgets() { return this.get(this.KEYS.BUDGETS); },
    saveBudgets(data) { this.save(this.KEYS.BUDGETS, data); },

    getReceipts() { return this.get(this.KEYS.RECEIPTS); },
    saveReceipts(data) { this.save(this.KEYS.RECEIPTS, data); },

    getFinance() { return this.get(this.KEYS.FINANCE); },
    saveFinance(data) { this.save(this.KEYS.FINANCE, data); },

    getAgenda() { return this.get(this.KEYS.AGENDA); },
    saveAgenda(data) { this.save(this.KEYS.AGENDA, data); },

    getMovements() { return this.get(this.KEYS.MOVEMENTS); },
    saveMovements(data) { this.save(this.KEYS.MOVEMENTS, data); },

    getCategories() { return this.get(this.KEYS.CATEGORIES); },
    saveCategories(data) { this.save(this.KEYS.CATEGORIES, data); },

    getOrders() { return this.get(this.KEYS.ORDERS); },
    saveOrders(data) { this.save(this.KEYS.ORDERS, data); },

    getUsers() {
        return this.get(this.KEYS.USERS);
    },

    getSettings() {
        return this.get(this.KEYS.SETTINGS);
    },

    getDashboardStats() {
        const clients = this.getClients();
        const budgets = this.getBudgets();
        const movements = this.getMovements();
        const services = this.getServices();

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const lastMonthDate = new Date(now);
        lastMonthDate.setMonth(now.getMonth() - 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastMonthYear = lastMonthDate.getFullYear();

        const calculateBilling = (mMonth, mYear) => {
            return movements
                .filter(m => {
                    if (!m.date || m.type !== 'Receita') return false;
                    const parts = m.date.split('/');
                    if (parts.length !== 3) return false;
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    return month === mMonth && year === mYear;
                })
                .reduce((acc, curr) => acc + parseFloat(curr.value || 0), 0);
        };

        const billing = calculateBilling(currentMonth, currentYear);
        const prevBilling = calculateBilling(lastMonth, lastMonthYear);

        return {
            billing,
            prevBilling,
            budgetsCount: budgets.filter(b => b.status === 'Pendente').length,
            totalBudgets: budgets.length,
            clientsCount: clients.length,
            servicesCount: services.length
        };
    },

    async syncOrders() {
        await this.syncFromFirebase(this.KEYS.ORDERS);
        return this.getOrders();
    }
};

export default Storage;
