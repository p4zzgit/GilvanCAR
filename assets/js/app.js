import Storage from './storage.js';
import { auth, db } from './firebase-init.js';

/**
 * Módulo Principal da UI - Gestão Pro
 */
console.log('Gestão Pro UI - v1.0.2 - 2026-07-11');
const ui = {
    currentTab: 'dashboard',
    currentBudgetStep: 1,
    budgetItems: [],
    storeCart: [],
    currentStoreSection: 'all',
    currentCalendarDate: new Date(),
    selectedCalendarDate: new Date().toISOString().split('T')[0],
    
    // Inicialização
    async init() {
        try {
            console.log('Inicializando UI...');
            window.ui = this;
            
            // Garantir que a UI seja interativa
            document.body.style.pointerEvents = 'auto';
            document.documentElement.style.pointerEvents = 'auto';
            
            this.setupEventListeners();
            console.log('Event listeners OK');
            this.applyTheme();
            
            // Sincronização inicial
            console.log('Iniciando Storage.init()...');
            try {
                await Storage.init();
                console.log('Sincronização Storage OK');
            } catch (storageErr) {
                console.error('Erro no Storage.init():', storageErr);
            }

            this.renderAll();
            console.log('Render All OK');
            this.handleRouting();
            console.log('Handle Routing OK');
            this.hideLoader();

            // Garantir que o loader desapareça rápido se algo falhar
            setTimeout(() => this.hideLoader(), 300);
            
            // Polling para garantir que cliques funcionem (agressivo contra overlays fantasmas)
            setInterval(() => {
                const overlays = document.querySelectorAll('.modal:not(.hidden), .loader:not(.hidden)');
                if (overlays.length === 0) {
                    if (document.body.style.pointerEvents === 'none') {
                        document.body.style.pointerEvents = 'auto';
                        document.documentElement.style.pointerEvents = 'auto';
                    }
                }
            }, 1000);
        } catch (err) {
            console.error('ERRO CRÍTICO NA INICIALIZAÇÃO:', err);
            this.hideLoader();
            document.body.style.pointerEvents = 'auto';
            document.documentElement.style.pointerEvents = 'auto';
        }
    },

    hideLoader() {
        const loader = document.getElementById('public-loader');
        if (loader) {
            loader.classList.add('hidden');
            loader.style.display = 'none';
        }
        document.body.style.pointerEvents = 'auto';
        document.documentElement.style.pointerEvents = 'auto';
    },

    setupEventListeners() {
        // Form Listeners
        const forms = {
            'form-login': (e) => this.login(e),
            'form-cliente': (e) => this.saveCliente(e),
            'form-produto': (e) => this.saveProduto(e),
            'form-servico': (e) => this.saveServico(e),
            'form-settings': (e) => this.saveConfig(e),
            'form-finance': (e) => this.saveFinance(e),
            'form-orcamento': (e) => this.saveOrcamento(e),
            'form-usuario': (e) => this.saveUser(e),
            'form-categoria': (e) => this.saveCategoria(e),
            'form-agenda': (e) => this.saveAgenda(e)
        };

        Object.entries(forms).forEach(([id, handler]) => {
            const el = document.getElementById(id);
            if (el) {
                el.onsubmit = (e) => {
                    e.preventDefault();
                    console.log('Form submetido:', id);
                    handler(e);
                    return false;
                };
            }
        });

        // Testar Conexão Firebase
        const btnTestDB = document.getElementById('btn-test-db');
        if (btnTestDB) {
            btnTestDB.onclick = () => this.testDB();
        }

        // Dynamic formatting masks
        const formatPhone = (val) => {
            const digits = val.replace(/\D/g, '').slice(0, 11);
            if (digits.length <= 10) {
                return digits
                    .replace(/^(\d{2})(\d)/g, '($1) $2')
                    .replace(/^(\(\d{2}\)\s\d{4})(\d)/g, '$1-$2');
            } else {
                return digits
                    .replace(/^(\d{2})(\d)/g, '($1) $2')
                    .replace(/^(\(\d{2}\)\s\d{5})(\d)/g, '$1-$2');
            }
        };

        const formatCpfCnpj = (val) => {
            const digits = val.replace(/\D/g, '').slice(0, 14);
            if (digits.length <= 11) {
                return digits
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
                    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
            } else {
                return digits
                    .replace(/^(\d{2})(\d)/, '$1.$2')
                    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
                    .replace(/(\d{4})(\d)/, '$1-$2');
            }
        };

        const formatMoney = (val) => {
            let digits = val.replace(/\D/g, '');
            if (digits === '') return '';
            const num = (parseFloat(digits) / 100).toFixed(2);
            const parts = num.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            return 'R$ ' + parts.join(',');
        };

        document.addEventListener('input', (e) => {
            const target = e.target;
            if (!target) return;

            if (target.classList.contains('mask-phone')) {
                target.value = formatPhone(target.value);
            } else if (target.classList.contains('mask-cpf-cnpj')) {
                target.value = formatCpfCnpj(target.value);
            } else if (target.classList.contains('mask-money')) {
                target.value = formatMoney(target.value);
            }
        });

        // Hash Navigation
        window.addEventListener('hashchange', () => this.handleRouting());

        // Sidebar Toggles
        const openSidebarBtn = document.getElementById('open-sidebar');
        const closeSidebarBtn = document.getElementById('close-sidebar');
        const sidebar = document.getElementById('sidebar');

        if (openSidebarBtn && sidebar) {
            openSidebarBtn.onclick = () => {
                sidebar.classList.remove('-translate-x-full');
            };
        }

        if (closeSidebarBtn && sidebar) {
            closeSidebarBtn.onclick = () => {
                sidebar.classList.add('-translate-x-full');
            };
        }

        // Close sidebar on mobile navigation
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('.nav-link') || e.target.closest('.mobile-nav-link');
            if (navLink && window.innerWidth < 768 && sidebar) {
                sidebar.classList.add('-translate-x-full');
            }
        });
    },

    handleRouting() {
        const hash = window.location.hash || '#dashboard';
        const page = hash.substring(1);
        
        // Se for rota pública
        if (page.startsWith('loja') || page.startsWith('orcamento/')) {
            this.showPublicView(page);
            return;
        }

        // Rota privada: verifica login
        if (!this.checkAuth()) {
            this.showLogin();
            return;
        }

        const appShell = document.getElementById('app-shell');
        if (appShell) {
            appShell.classList.remove('hidden');
            appShell.style.display = 'flex';
        }
        this.setTab(page);
    },

    checkAuth() {
        return !!localStorage.getItem(Storage.KEYS.AUTH);
    },

    cleanMoney(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const cleaned = val.replace(/[^\d]/g, '');
        return cleaned ? parseFloat(cleaned) / 100 : 0;
    },

    showLogin() {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
            loginScreen.style.display = 'flex';
        }
        const appShell = document.getElementById('app-shell');
        if (appShell) appShell.classList.add('hidden');

        // Auto-populate remembered login
        const remUser = localStorage.getItem('remember_me_user');
        const remPass = localStorage.getItem('remember_me_pass');
        const userEl = document.getElementById('login-user');
        const passEl = document.getElementById('login-pass');
        const remCheckbox = document.getElementById('login-remember');

        if (userEl && remUser) userEl.value = remUser;
        if (passEl && remPass) passEl.value = remPass;
        if (remCheckbox && remUser) remCheckbox.checked = true;
    },

    async login(e) {
        if (e) e.preventDefault();
        console.log('Tentando login...');
        
        const userEl = document.getElementById('login-user');
        const passEl = document.getElementById('login-pass');
        const btn = document.querySelector('#form-login button[type="submit"]') || document.querySelector('#form-login button');
        
        if (!userEl || !passEl) return;

        const user = userEl.value.trim();
        const pass = passEl.value.trim();
        const remember = document.getElementById('login-remember') ? document.getElementById('login-remember').checked : false;
        
        if (btn) {
            btn.disabled = true;
            btn.dataset.oldText = btn.innerHTML;
            btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Entrando...</span>';
            if (window.lucide) window.lucide.createIcons();
        }

        try {
            await new Promise(r => setTimeout(r, 400));
            const users = Storage.getUsers();
            const found = users.find(u => (u.user === user || u.email === user) && u.pass === pass);
            
            if (found) {
                console.log('Login OK:', found.name);
                localStorage.setItem(Storage.KEYS.AUTH, JSON.stringify(found));
                
                if (remember) {
                    localStorage.setItem('remember_me_user', user);
                    localStorage.setItem('remember_me_pass', pass);
                } else {
                    localStorage.removeItem('remember_me_user');
                    localStorage.removeItem('remember_me_pass');
                }

                document.getElementById('login-screen').classList.add('hidden');
                const shell = document.getElementById('app-shell');
                if (shell) {
                    shell.classList.remove('hidden');
                    shell.style.display = 'flex';
                }
                
                userEl.value = '';
                passEl.value = '';
                
                window.location.hash = '#dashboard';
                this.handleRouting();
            } else {
                alert('Usuário ou senha incorretos. Tente admin / admin');
            }
        } catch (err) {
            console.error('Erro login:', err);
            alert('Erro ao processar login.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = btn.dataset.oldText || 'Entrar no Sistema';
                if (window.lucide) window.lucide.createIcons();
            }
        }
    },

    logout() {
        localStorage.removeItem(Storage.KEYS.AUTH);
        window.location.hash = '#login';
        window.location.reload();
    },

    setTab(page) {
        this.currentTab = page;
        console.log('Navegando para:', page);
        
        // Update Sidebar
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.dataset.page === page) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Update Mobile Bottom Nav
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            if (link.dataset.page === page) {
                link.classList.add('active');
                // Scroll into view if it's horizontal scrollable
                link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                link.classList.remove('active');
            }
        });

        // Update Pages
        document.querySelectorAll('.page').forEach(p => {
            if (p.id === page) {
                p.classList.add('active');
                p.style.display = 'block';
            } else {
                p.classList.remove('active');
                p.style.display = 'none';
            }
        });

        // Update Header Title
        const titleEl = document.getElementById('page-title');
        if (titleEl) {
            const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
            if (activeLink) {
                titleEl.innerText = activeLink.innerText.trim();
            } else {
                const titles = {
                    'dashboard': 'Visão Geral',
                    'financeiro': 'Financeiro',
                    'clientes': 'Clientes',
                    'produtos': 'Produtos',
                    'servicos': 'Serviços',
                    'orcamentos': 'Orçamentos',
                    'pedidos-recebidos': 'Pedidos Recebidos',
                    'configuracoes': 'Configurações',
                    'link-vendas': 'Link de Vendas',
                    'relatorios': 'Relatórios',
                    'agenda': 'Agenda',
                    'gestao-usuarios': 'Gestão de Usuários'
                };
                titleEl.innerText = titles[page] || 'Gestão Pro';
            }
        }

        this.loadTabContent(page);
        if (window.lucide) window.lucide.createIcons();
        
        // Destravar cliques globalmente
        document.body.style.pointerEvents = 'auto';
        document.documentElement.style.pointerEvents = 'auto';
    },

    loadTabContent(tab) {
        switch(tab) {
            case 'dashboard': this.loadDashboard(); break;
            case 'financeiro': this.loadFinanceiro(); break;
            case 'clientes': this.loadClientes(); break;
            case 'produtos': this.loadProdutos(); break;
            case 'servicos': this.loadServicos(); break;
            case 'orcamentos': this.loadOrcamentos(); break;
            case 'pedidos-recebidos': this.loadOrders(); break;
            case 'configuracoes': this.loadConfiguracoes(); break;
            case 'link-vendas': this.loadLinkVendas(); break;
            case 'relatorios': this.loadRelatorios(); break;
            case 'agenda': this.loadAgenda(); break;
            case 'gestao-usuarios': this.loadUsuarios(); break;
        }
    },

    loadUsuarios() {
        const users = Storage.getUsers();
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        tbody.innerHTML = users.map(user => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors border-b border-gray-100 dark:border-gray-800">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                            ${(user.name || 'U').substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-900 dark:text-white">${user.name || 'Usuário Sem Nome'}</p>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">${user.role || 'Operador'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400">${user.user || user.login || user.email || '-'}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${user.status === 'Ativo' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                        ${user.status || 'Ativo'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right flex justify-end gap-2">
                    <button onclick="ui.editUser('${user.id}')" class="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors" title="Editar">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    ${user.id !== 'admin' ? `
                        <button onclick="ui.deleteUser('${user.id}')" class="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors" title="Excluir">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    async deleteUser(id) {
        if (id === 'admin') {
            alert('O Administrador Principal não pode ser excluído.');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir este usuário?\nEsta ação não poderá ser desfeita.')) return;
        
        try {
            await Storage.removeItem(Storage.KEYS.USERS, id);
            this.loadUsuarios();
            alert('Usuário excluído com sucesso!');
        } catch (err) {
            console.error('Erro ao excluir usuário:', err);
            alert('Erro ao excluir usuário.');
        }
    },

    loadAgenda() {
        this.renderCalendar();
        this.renderAgendaDay(this.selectedCalendarDate);
        
        // Populate clients in modal
        const clients = Storage.getClients();
        const select = document.getElementById('agenda-client');
        if (select) {
            select.innerHTML = '<option value="">Selecione um cliente</option>' + 
                clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
    },

    changeMonth(offset) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + offset);
        this.renderCalendar();
    },

    renderCalendar() {
        const grid = document.getElementById('calendar-days');
        const monthYearLabel = document.getElementById('calendar-month-year');
        if (!grid || !monthYearLabel) return;

        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        monthYearLabel.innerText = `${months[month]} ${year}`;

        const agenda = Storage.getAgenda();
        const todayStr = new Date().toISOString().split('T')[0];

        let html = '';
        
        // Empty cells for first week
        for (let i = 0; i < firstDay; i++) {
            html += `<div class="aspect-square bg-gray-50/30 dark:bg-gray-800/20 border-r border-b border-gray-100 dark:border-gray-800"></div>`;
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEvents = agenda.some(item => item.date === dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this.selectedCalendarDate;

            html += `
                <div onclick="ui.selectCalendarDay('${dateStr}')" class="aspect-square border-r border-b border-gray-100 dark:border-gray-800 p-2 relative cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}">
                    <span class="text-[10px] font-black ${isToday ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-gray-500 dark:text-gray-400'}">
                        ${day}
                    </span>
                    ${hasEvents ? '<div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full shadow-[0_0_5px_rgba(37,99,235,0.8)]"></div>' : ''}
                </div>
            `;
        }

        grid.innerHTML = html;
    },

    selectCalendarDay(date) {
        this.selectedCalendarDate = date;
        this.renderCalendar();
        this.renderAgendaDay(date);
    },

    renderAgendaDay(date) {
        const container = document.getElementById('agenda-day-events');
        const label = document.getElementById('selected-day-label');
        const dateEl = document.getElementById('selected-day-date');
        if (!container) return;

        const dateObj = new Date(date + 'T12:00:00');
        const formattedDate = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        
        label.innerText = 'Agenda do Dia';
        dateEl.innerText = formattedDate;

        const agenda = Storage.getAgenda();
        const dayEvents = agenda.filter(item => item.date === date).sort((a, b) => a.time.localeCompare(b.time));

        if (dayEvents.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <i data-lucide="coffee" class="w-8 h-8"></i>
                    </div>
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum compromisso agendado para este dia.</p>
                    <button onclick="ui.prepareNewAgendaItem('${date}')" class="mt-4 text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">Agendar Agora</button>
                </div>
            `;
        } else {
            container.innerHTML = dayEvents.map(event => `
                <div class="group relative bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 font-black text-[10px]">
                                ${event.time}
                            </div>
                            <div>
                                <h4 class="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight">${event.title}</h4>
                                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">${event.client}</p>
                            </div>
                        </div>
                        <button onclick="ui.deleteAgendaItem('${event.id}')" class="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                    ${event.notes ? `<p class="text-[10px] text-gray-500 mt-3 pl-13 line-clamp-2 italic border-l-2 border-gray-100 dark:border-gray-800 pl-4">${event.notes}</p>` : ''}
                </div>
            `).join('');
        }
        if (window.lucide) window.lucide.createIcons();
    },

    prepareNewAgendaItem(date) {
        document.getElementById('agenda-date').value = date;
        this.openModal('modal-agenda');
    },

    async deleteAgendaItem(id) {
        if (!confirm('Deseja realmente excluir este agendamento?')) return;
        
        try {
            const agenda = Storage.getAgenda();
            const filtered = agenda.filter(i => i.id !== id);
            await Storage.save(Storage.KEYS.AGENDA, filtered);
            this.loadAgenda();
        } catch (err) {
            alert('Erro ao excluir agendamento.');
        }
    },

    loadDashboard() {
        const stats = Storage.getDashboardStats();
        const billingEl = document.getElementById('dash-billing');
        const budgetsEl = document.getElementById('dash-budgets');
        const clientsEl = document.getElementById('dash-clients');
        const servicesEl = document.getElementById('dash-services');

        if (billingEl) billingEl.innerText = `R$ ${stats.billing.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (budgetsEl) budgetsEl.innerText = stats.budgetsCount;
        if (clientsEl) clientsEl.innerText = stats.clientsCount;
        if (servicesEl) servicesEl.innerText = stats.servicesCount;

        // Update Billing Trend and Progress
        const billingTrendEl = document.getElementById('dash-billing-trend');
        const billingProgressEl = document.getElementById('dash-billing-progress');
        if (billingTrendEl && billingProgressEl) {
            if (stats.billing > 0) {
                // Se houver faturamento, mostramos tendência se tiver anterior
                if (stats.prevBilling > 0) {
                    const diff = ((stats.billing - stats.prevBilling) / stats.prevBilling) * 100;
                    billingTrendEl.innerText = `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
                    billingTrendEl.className = `text-[10px] font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`;
                    billingTrendEl.classList.remove('hidden');
                } else {
                    billingTrendEl.classList.add('hidden');
                }
                
                // Progresso baseado em uma meta fictícia de 10k para visualização
                const target = 10000;
                const progress = Math.min((stats.billing / target) * 100, 100);
                billingProgressEl.style.width = `${progress}%`;
            } else {
                billingTrendEl.classList.add('hidden');
                billingProgressEl.style.width = '0%';
            }
        }

        // Update Budgets Progress
        const budgetsProgressEl = document.getElementById('dash-budgets-progress');
        if (budgetsProgressEl) {
            if (stats.totalBudgets > 0) {
                const progress = (stats.budgetsCount / stats.totalBudgets) * 100;
                budgetsProgressEl.style.width = `${progress}%`;
            } else {
                budgetsProgressEl.style.width = '0%';
            }
        }

        this.renderRecentServices();
        this.renderDashboardCharts();
    },

    renderRecentServices() {
        const container = document.getElementById('recent-services-list');
        if (!container) return;

        const budgets = Storage.getBudgets();
        // Mostrar apenas orçamentos concluídos ou pendentes recentes
        const recent = budgets.sort((a, b) => (b.number || 0) - (a.number || 0)).slice(0, 8);

        if (recent.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-gray-400 opacity-60">
                    <i data-lucide="inbox" class="w-10 h-10 mb-2"></i>
                    <p class="text-[10px] font-black uppercase tracking-widest text-center">Nenhum serviço registrado</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = recent.map(b => `
            <div onclick="ui.viewBudget('${b.id}')" class="px-6 py-4 border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all cursor-pointer group">
                <div class="flex justify-between items-start mb-1.5">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <p class="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight line-clamp-1">${b.clientName || 'Cliente sem nome'}</p>
                            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Orçamento #${b.number || '---'}</p>
                        </div>
                    </div>
                    <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${b.status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} uppercase tracking-widest">${b.status}</span>
                </div>
                <div class="flex justify-between items-center mt-2 pl-10">
                    <p class="text-[10px] text-gray-400 font-medium">Cadastrado em ${b.date || '---'}</p>
                    <p class="text-[11px] font-black text-gray-900 dark:text-white">R$ ${parseFloat(b.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    renderDashboardCharts() {
        const canvas = document.getElementById('financeChart');
        if (!canvas) return;

        // Aguardar o Chart.js carregar se necessário
        if (!window.Chart) {
            console.warn('Chart.js não encontrado, tentando novamente em 1s...');
            setTimeout(() => this.renderDashboardCharts(), 300);
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Destruir instância anterior de forma segura
        if (this.charts && this.charts.finance) {
            try {
                this.charts.finance.destroy();
            } catch(e) { console.warn('Erro ao destruir gráfico:', e); }
        }

        this.charts = this.charts || {};
        const movements = Storage.getMovements();
        const now = new Date();
        const days = [];
        const incomes = [];
        const expenses = [];
        let hasData = false;

        // Gerar dados para os últimos 7 dias
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('pt-BR');
            days.push(dateStr.substring(0, 5)); // DD/MM

            const dayIn = movements
                .filter(m => m.date === dateStr && m.type === 'Receita')
                .reduce((acc, curr) => acc + parseFloat(curr.value || 0), 0);
            const dayOut = movements
                .filter(m => m.date === dateStr && m.type === 'Despesa')
                .reduce((acc, curr) => acc + parseFloat(curr.value || 0), 0);

            if (dayIn > 0 || dayOut > 0) hasData = true;
            incomes.push(dayIn);
            expenses.push(dayOut);
        }

        // Se não houver dados, mostrar mensagem no canvas
        if (!hasData) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados disponíveis para os últimos 7 dias', canvas.width / 2, canvas.height / 2);
            return;
        }

        this.charts = this.charts || {};
        try {
            this.charts.finance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: days,
                    datasets: [
                        {
                            label: 'Entradas',
                            data: incomes,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.05)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#10b981',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Saídas',
                            data: expenses,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#ef4444',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            padding: 12,
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleFont: { size: 11, weight: 'bold', family: 'Inter' },
                            bodyFont: { size: 12, family: 'Inter' },
                            cornerRadius: 8,
                            boxPadding: 4,
                            callbacks: {
                                label: (context) => {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) {
                                        label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { 
                                font: { size: 9, weight: 'bold', family: 'Inter' }, 
                                color: '#94a3b8',
                                padding: 10
                            }
                        },
                        y: {
                            grid: { 
                                color: 'rgba(148, 163, 184, 0.05)',
                                drawBorder: false
                            },
                            ticks: { 
                                font: { size: 9, family: 'Inter' }, 
                                color: '#94a3b8',
                                padding: 10,
                                callback: (value) => 'R$ ' + value
                            }
                        }
                    }
                }
            });
        } catch(e) {
            console.error('Erro ao renderizar gráfico:', e);
        }
    },

    loadOrders() {
        const orders = Storage.getOrders();
        const tbody = document.getElementById('orders-table-body');
        if (!tbody) return;

        tbody.innerHTML = orders.map(order => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors border-b border-gray-100 dark:border-gray-800">
                <td class="px-6 py-4 text-xs font-bold text-gray-900 dark:text-white">#${order.number}</td>
                <td class="px-6 py-4">
                    <p class="text-sm font-bold text-gray-900 dark:text-white">${order.clientName}</p>
                </td>
                <td class="px-6 py-4 text-sm font-bold">R$ ${parseFloat(order.total).toFixed(2)}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold rounded-full">${order.status}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="ui.viewOrder('${order.id}')" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    loadClientes() {
        const clients = Storage.getClients();
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;

        tbody.innerHTML = clients.map(client => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors border-b border-gray-100 dark:border-gray-800">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                            ${client.name.substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-900 dark:text-white">${client.name}</p>
                            <p class="text-[10px] text-gray-500">${client.email || 'Sem e-mail'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="badge badge-success">Ativo</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                        ${client.phone ? `<button onclick="window.open('https://wa.me/55${client.phone.replace(/\D/g, '')}', '_blank')" class="p-2 hover:bg-green-50 text-green-600 rounded-lg" title="WhatsApp"><i data-lucide="message-circle" class="w-4 h-4"></i></button>` : ''}
                        <button onclick="ui.editClient('${client.id}')" class="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="ui.deleteItem('CLIENTS', '${client.id}')" class="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    loadProdutos() {
        const products = Storage.getProducts();
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;

        // Filter by category
        const filterCat = document.getElementById('filter-product-category');
        const selectedCat = filterCat ? filterCat.value : 'all';
        
        const filteredProducts = selectedCat === 'all' ? products : products.filter(p => p.category === selectedCat);

        tbody.innerHTML = filteredProducts.map(product => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors border-b border-gray-100 dark:border-gray-800">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <i data-lucide="package" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-900 dark:text-white">${product.name}</p>
                            <p class="text-[10px] text-gray-500">Ref: ${product.ref || '-'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm font-bold">
                    <span class="${(product.stock || 0) <= (product.minStock || 5) ? 'text-red-600' : 'text-gray-900 dark:text-white'}">
                        ${product.stock || 0} ${product.unit || 'un'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm font-bold">R$ ${parseFloat(product.price || 0).toFixed(2)}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="ui.editProduct('${product.id}')" class="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="ui.deleteItem('PRODUCTS', '${product.id}')" class="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Low stock table
        const lowStockTbody = document.getElementById('low-stock-table-body');
        if (lowStockTbody) {
            const lowStockItems = products.filter(p => parseInt(p.stock || 0) <= parseInt(p.minStock || 5));
            lowStockTbody.innerHTML = lowStockItems.map(p => `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors border-b border-gray-100 dark:border-gray-800">
                    <td class="px-6 py-4">
                        <p class="text-sm font-bold text-gray-900 dark:text-white">${p.name}</p>
                        <p class="text-[10px] text-gray-500">${p.category}</p>
                    </td>
                    <td class="px-6 py-4 text-center text-sm font-black text-red-600">${p.stock || 0}</td>
                    <td class="px-6 py-4 text-center text-sm font-bold text-gray-500">${p.minStock || 5}</td>
                    <td class="px-6 py-4 text-right text-sm font-bold text-red-600">-${Math.max(0, parseInt(p.minStock || 5) - parseInt(p.stock || 0))}</td>
                </tr>
            `).join('');
        }

        if (window.lucide) window.lucide.createIcons();
    },

    loadServicos() {
        const services = Storage.getServices();
        const grid = document.getElementById('services-grid');
        if (!grid) return;

        grid.innerHTML = services.map(service => `
            <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <i data-lucide="wrench" class="w-6 h-6"></i>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="ui.editService('${service.id}')" class="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="ui.deleteItem('SERVICES', '${service.id}')" class="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
                <h4 class="font-bold text-gray-900 dark:text-white mb-1">${service.name}</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">${service.description || 'Sem descrição'}</p>
                <div class="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-gray-800">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">${service.category || 'Geral'}</span>
                    <span class="text-lg font-black text-gray-900 dark:text-white">R$ ${parseFloat(service.price || 0).toFixed(2)}</span>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    loadOrcamentos() {
        const budgets = Storage.getBudgets();
        const grid = document.getElementById('budgets-grid');
        if (!grid) return;

        if (budgets.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <i data-lucide="file-text" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                    <p class="text-sm font-bold text-gray-500 uppercase tracking-widest">Nenhum orçamento encontrado</p>
                    <button onclick="ui.openModal('modal-orcamento')" class="mt-4 text-blue-600 font-black text-[10px] uppercase tracking-widest">Criar Primeiro Orçamento</button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = budgets.map(budget => `
            <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Orçamento #${budget.number}</span>
                        <h4 class="font-bold text-gray-900 dark:text-white mt-1 line-clamp-1">${budget.clientName}</h4>
                    </div>
                    <span class="badge ${budget.status === 'Aprovado' ? 'badge-success' : (budget.status === 'Rejeitado' ? 'badge-danger' : 'badge-warning')}">${budget.status}</span>
                </div>
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Total</p>
                        <p class="text-xl font-black text-gray-900 dark:text-white">R$ ${parseFloat(budget.total || 0).toFixed(2)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</p>
                        <p class="text-xs font-bold text-gray-600 dark:text-gray-400">${budget.date}</p>
                    </div>
                </div>
                <div class="flex gap-2 pt-4 border-t border-gray-50 dark:border-gray-800">
                    <button onclick="ui.viewBudget('${budget.id}')" class="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white">
                        <i data-lucide="eye" class="w-4 h-4"></i> Ver
                    </button>
                    <button onclick="ui.copyBudgetLink('${budget.id}')" class="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all" title="Copiar Link">
                        <i data-lucide="link" class="w-4 h-4"></i>
                    </button>
                    <button onclick="ui.editBudget('${budget.id}')" class="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="ui.deleteItem('BUDGETS', '${budget.id}')" class="p-2.5 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    loadFinanceiro() {
        let movements = Storage.getMovements();
        const tbody = document.getElementById('finance-table-body');
        if (!tbody) return;

        // Filter by Period
        const periodFilter = document.getElementById('finance-filter-period');
        const period = periodFilter ? periodFilter.value : 'all';
        
        if (period !== 'all') {
            const now = new Date();
            movements = movements.filter(m => {
                const mDate = this.parseDate(m.date);
                if (!mDate) return false;
                
                if (period === 'today') {
                    return mDate.toDateString() === now.toDateString();
                } else if (period === 'this_month') {
                    return mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
                } else if (period === 'this_year') {
                    return mDate.getFullYear() === now.getFullYear();
                } else {
                    const daysAgo = parseInt(period);
                    const diffMs = now - mDate;
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    return diffDays <= daysAgo && diffDays >= 0;
                }
            });
        }

        // Filter by Type
        const typeFilter = document.getElementById('finance-filter-type');
        const type = typeFilter ? typeFilter.value : 'all';
        if (type !== 'all') {
            movements = movements.filter(m => {
                if (type === 'entrada') return m.type === 'Receita';
                if (type === 'saida') return m.type === 'Despesa';
                return true;
            });
        }

        // Sort by date descending
        movements.sort((a, b) => {
            const dateA = this.parseDate(a.date);
            const dateB = this.parseDate(b.date);
            return (dateB || 0) - (dateA || 0);
        });

        tbody.innerHTML = movements.map(m => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                <td class="px-6 py-4 text-[10px] font-bold text-gray-500">${m.date}</td>
                <td class="px-6 py-4">
                    <p class="text-sm font-bold text-gray-900 dark:text-white">${m.description}</p>
                </td>
                <td class="px-6 py-4">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">${m.category}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <span class="text-sm font-black ${m.type === 'Receita' ? 'text-green-600' : 'text-red-600'}">
                        ${m.type === 'Receita' ? '+' : '-'} R$ ${parseFloat(m.value || 0).toFixed(2)}
                    </span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="badge ${m.type === 'Receita' ? 'badge-success' : 'badge-danger'}">${m.type}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="ui.deleteItem('MOVEMENTS', '${m.id}')" class="p-2 hover:bg-red-50 text-red-600 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join('');
        
        this.updateFinanceSummary(movements);
        if (window.lucide) window.lucide.createIcons();
    },

    parseDate(dateStr) {
        if (!dateStr) return null;
        if (dateStr.includes('-')) return new Date(dateStr); // ISO YYYY-MM-DD
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // DD/MM/YYYY
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return new Date(dateStr);
    },

    updateFinanceSummary(movements) {
        const receita = movements.filter(m => m.type === 'Receita').reduce((a, b) => a + parseFloat(b.value || 0), 0);
        const despesa = movements.filter(m => m.type === 'Despesa').reduce((a, b) => a + parseFloat(b.value || 0), 0);
        const saldo = receita - despesa;

        const receitaEl = document.getElementById('finance-total-in');
        const despesaEl = document.getElementById('finance-total-out');
        const saldoEl = document.getElementById('finance-total-balance');

        if (receitaEl) receitaEl.innerText = `R$ ${receita.toFixed(2)}`;
        if (despesaEl) despesaEl.innerText = `R$ ${despesa.toFixed(2)}`;
        if (saldoEl) saldoEl.innerText = `R$ ${saldo.toFixed(2)}`;
    },

    loadCategorias() {
        const categories = Storage.getCategories();
        const tbody = document.getElementById('categories-list');
        if (!tbody) return;

        tbody.innerHTML = categories.map(cat => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <i data-lucide="${cat.icon || 'tag'}" class="w-4 h-4 text-gray-500"></i>
                        </div>
                        <span class="text-sm font-bold text-gray-900 dark:text-white">${cat.name}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">${cat.type || 'Produtos'}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="ui.editCategory('${cat.id}')" class="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="ui.deleteItem('CATEGORIES', '${cat.id}')" class="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        if (window.lucide) window.lucide.createIcons();
        this.populateCategorySelects();
    },

    populateCategorySelects() {
        const categories = Storage.getCategories();
        
        // Product Categories
        const productSelects = ['product-category', 'filter-product-category'];
        productSelects.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const current = el.value;
                const options = categories
                    .filter(c => c.type === 'Produtos' || c.type === 'Ambos' || !c.type)
                    .map(c => `<option value="${c.name}">${c.name}</option>`);
                
                if (id.startsWith('filter')) {
                    el.innerHTML = '<option value="all">Todas as Categorias</option>' + options.join('');
                } else {
                    el.innerHTML = '<option value="">Selecione uma Categoria</option>' + options.join('');
                }
                el.value = current;
            }
        });

        // Service Categories
        const serviceSelects = ['service-category'];
        serviceSelects.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const current = el.value;
                const options = categories
                    .filter(c => c.type === 'Serviços' || c.type === 'Ambos')
                    .map(c => `<option value="${c.name}">${c.name}</option>`);
                
                el.innerHTML = '<option value="">Selecione uma Categoria</option>' + options.join('');
                el.value = current;
            }
        });
    },

    loadConfiguracoes() {
        const settings = Storage.getSettings();
        
        const fields = {
            'settings-company-name': 'companyName',
            'settings-cnpj': 'cnpj',
            'settings-address': 'address',
            'settings-phone': 'phone',
            'settings-whatsapp': 'whatsapp',
            'settings-tab-title': 'tabTitle',
            'settings-primary-color': 'primaryColor',
            'settings-store-slug': 'storeSlug'
        };

        Object.entries(fields).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.value = settings[key] || '';
        });

        const storeActive = document.getElementById('store-active');
        const showPrices = document.getElementById('store-show-prices');
        if (storeActive) storeActive.checked = settings.storeActive ?? true;
        if (showPrices) showPrices.checked = settings.storeShowPrices ?? true;

        // Logo Preview
        const logoPreview = document.getElementById('settings-logo-preview');
        const logoPlaceholder = document.getElementById('settings-logo-placeholder');
        const logoBtnRemove = document.getElementById('btn-remove-logo');
        if (settings.logo && logoPreview) {
            logoPreview.src = settings.logo;
            logoPreview.classList.remove('hidden');
            if (logoPlaceholder) logoPlaceholder.classList.add('hidden');
            if (logoBtnRemove) logoBtnRemove.classList.remove('hidden');
        } else {
            if (logoPreview) logoPreview.classList.add('hidden');
            if (logoPlaceholder) logoPlaceholder.classList.remove('hidden');
            if (logoBtnRemove) logoBtnRemove.classList.add('hidden');
        }

        // Favicon Preview
        const faviconPreview = document.getElementById('settings-favicon-preview');
        const faviconPlaceholder = document.getElementById('settings-favicon-placeholder');
        const faviconBtnRemove = document.getElementById('btn-remove-favicon');
        if (settings.favicon && faviconPreview) {
            faviconPreview.src = settings.favicon;
            faviconPreview.classList.remove('hidden');
            if (faviconPlaceholder) faviconPlaceholder.classList.add('hidden');
            if (faviconBtnRemove) faviconBtnRemove.classList.remove('hidden');
        } else {
            if (faviconPreview) faviconPreview.classList.add('hidden');
            if (faviconPlaceholder) faviconPlaceholder.classList.remove('hidden');
            if (faviconBtnRemove) faviconBtnRemove.classList.add('hidden');
        }

        // Sync primary color text and hex display
        const colorHex = document.getElementById('primary-color-hex');
        if (colorHex) colorHex.innerText = settings.primaryColor || '#2563EB';
        
        const colorText = document.getElementById('settings-primary-color-text');
        if (colorText) colorText.value = settings.primaryColor || '#2563EB';

        this.applyTheme();
    },
    
    // Theme Management
    setTheme(theme) {
        const settings = Storage.getSettings();
        settings.theme = theme;
        
        // Salvar localmente e iniciar sincronização em background
        Storage.saveItem(Storage.KEYS.SETTINGS, settings);
        
        // Aplicar imediatamente
        this.applyTheme();
        this.showToast(`Tema ${theme === 'dark' ? 'Escuro' : 'Claro'} aplicado`);
    },

    applyTheme() {
        const settings = Storage.getSettings();
        const theme = settings.theme || 'dark';
        
        // Atributos de Tema
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Atualizar Botões de Tema Ativos
        document.querySelectorAll('.theme-toggle-btn, .settings-theme-btn').forEach(btn => {
            if (btn.id.includes(theme)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Aplicar Cor Principal
        if (settings.primaryColor) {
            document.documentElement.style.setProperty('--brand', settings.primaryColor);
        }

        // Favicon e Título da Aba
        if (settings.favicon) {
            this.updateFavicon(settings.favicon);
        }
        if (settings.tabTitle) {
            document.title = settings.tabTitle;
        } else {
            document.title = 'Sistema de Gestão Pro';
        }

        // Atualizar Nome da Empresa no Header/Sidebar
        const companyNameEls = [
            document.getElementById('header-company-name'),
            document.getElementById('company-name-nav')
        ];
        companyNameEls.forEach(el => {
            if (el) el.innerText = settings.companyName || 'Gestão Pro';
        });
    },

    updateFavicon(url) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = url || '/favicon.ico';
    },

    // Modal Management
    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    togglePassword(id) {
        const input = document.getElementById(id);
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
        }
    },

    // Ações Genéricas
    async deleteItem(storageKey, id) {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        
        await Storage.removeItem(Storage.KEYS[storageKey], id);
        this.renderTabContent(this.currentTab);
    },

    // Edições
    editClient(id) { 
        const client = Storage.getClients().find(c => c.id === id);
        if (client) {
            const form = document.getElementById('form-cliente');
            if (form) {
                form.dataset.editId = id;
                document.getElementById('client-name').value = client.name || '';
                document.getElementById('client-email').value = client.email || '';
                document.getElementById('client-phone').value = client.phone || '';
                document.getElementById('client-document').value = client.cpf_cnpj || '';
                if (document.getElementById('client-address')) {
                    document.getElementById('client-address').value = client.address || '';
                }
                if (document.getElementById('client-notes')) {
                    document.getElementById('client-notes').value = client.notes || '';
                }
                document.getElementById('modal-cliente-title').innerText = 'Editar Cliente';
            }
            this.openModal('modal-cliente');
        }
    },

    editProduct(id) { 
        const product = Storage.getProducts().find(p => p.id === id);
        if (product) {
            const form = document.getElementById('form-produto');
            if (form) {
                form.dataset.editId = id;
                document.getElementById('product-name').value = product.name || '';
                document.getElementById('product-price').value = product.price || '';
                document.getElementById('product-stock').value = product.stock || 0;
                document.getElementById('product-ref').value = product.ref || '';
                document.getElementById('product-category').value = product.category || '';
                document.getElementById('product-description').value = product.description || '';
                document.getElementById('modal-produto-title').innerText = 'Editar Produto';
            }
            this.openModal('modal-produto');
        }
    },

    editService(id) { 
        const service = Storage.getServices().find(s => s.id === id);
        if (service) {
            const form = document.getElementById('form-servico');
            if (form) {
                form.dataset.editId = id;
                document.getElementById('service-name').value = service.name || '';
                document.getElementById('service-price').value = service.price || '';
                document.getElementById('service-category').value = service.category || '';
                document.getElementById('service-description').value = service.description || '';
                document.getElementById('modal-servico-title').innerText = 'Editar Serviço';
            }
            this.openModal('modal-servico');
        }
    },

    viewBudget(id) {
        const budget = Storage.getBudgets().find(b => b.id === id);
        if (!budget) return;

        this.currentViewingBudget = budget;

        // Preencher Modal de Visualização
        const idEl = document.getElementById('view-budget-id');
        const statusEl = document.getElementById('view-budget-status');
        const dateEl = document.getElementById('view-budget-date');
        
        if (idEl) idEl.innerText = `Orçamento #${budget.number}`;
        if (statusEl) {
            statusEl.innerText = budget.status;
            statusEl.className = `badge ${budget.status === 'Aprovado' ? 'badge-success' : (budget.status === 'Rejeitado' ? 'badge-danger' : 'badge-warning')}`;
        }
        if (dateEl) dateEl.innerText = `Criado em: ${budget.date}`;

        // Dados do Cliente
        const clientNameEl = document.getElementById('view-client-name');
        const clientDocEl = document.getElementById('view-client-doc');
        const clientPhoneEl = document.getElementById('view-client-whatsapp') || document.getElementById('view-client-phone');
        const clientEmailEl = document.getElementById('view-client-email');
        const clientAddressEl = document.getElementById('view-client-address');

        if (clientNameEl) clientNameEl.innerText = budget.clientName;
        if (clientDocEl) clientDocEl.innerText = budget.clientDoc || '-';
        if (clientPhoneEl) clientPhoneEl.innerText = budget.clientPhone || '-';
        if (clientEmailEl) clientEmailEl.innerText = budget.clientEmail || '-';
        if (clientAddressEl) clientAddressEl.innerText = budget.clientAddress || '-';

        // Veículo
        const vehicleSection = document.getElementById('view-vehicle-section');
        if (vehicleSection) {
            if (budget.vehicle && budget.vehicle.plate) {
                vehicleSection.classList.remove('hidden');
                document.getElementById('view-vehicle-model').innerText = budget.vehicle.model || '-';
                document.getElementById('view-vehicle-plate').innerText = budget.vehicle.plate || '-';
                document.getElementById('view-vehicle-year-color').innerText = `${budget.vehicle.year || '-'}/${budget.vehicle.color || '-'}`;
                document.getElementById('view-vehicle-km').innerText = budget.vehicle.km || '-';
            } else {
                vehicleSection.classList.add('hidden');
            }
        }

        // Itens
        const servicesContainer = document.getElementById('view-services-container');
        const productsContainer = document.getElementById('view-products-container');
        const servicesBody = document.getElementById('view-services-table-body');
        const productsBody = document.getElementById('view-products-table-body');

        const services = budget.items.filter(i => i.type === 'service');
        const products = budget.items.filter(i => i.type === 'product');

        if (servicesContainer) {
            if (services.length > 0) {
                servicesContainer.classList.remove('hidden');
                if (servicesBody) {
                    servicesBody.innerHTML = services.map(s => `
                        <tr class="border-b border-gray-50 dark:border-gray-800 last:border-0">
                            <td class="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">${s.name}</td>
                            <td class="px-6 py-4 text-center text-xs text-gray-500 font-bold uppercase tracking-widest">-</td>
                            <td class="px-6 py-4 text-right text-sm font-bold text-gray-600 dark:text-gray-400">R$ ${parseFloat(s.price).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right text-sm font-black text-gray-900 dark:text-white">R$ ${(parseFloat(s.price) * (s.qty || 1)).toFixed(2)}</td>
                        </tr>
                    `).join('');
                }
            } else {
                servicesContainer.classList.add('hidden');
            }
        }

        if (productsContainer) {
            if (products.length > 0) {
                productsContainer.classList.remove('hidden');
                if (productsBody) {
                    productsBody.innerHTML = products.map(p => `
                        <tr class="border-b border-gray-50 dark:border-gray-800 last:border-0">
                            <td class="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">${p.name}</td>
                            <td class="px-6 py-4 text-center text-xs text-gray-500 font-bold uppercase tracking-widest">${p.qty}x</td>
                            <td class="px-6 py-4 text-right text-sm font-bold text-gray-600 dark:text-gray-400">R$ ${parseFloat(p.price).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right text-sm font-black text-gray-900 dark:text-white">R$ ${(parseFloat(p.price) * p.qty).toFixed(2)}</td>
                        </tr>
                    `).join('');
                }
            } else {
                productsContainer.classList.add('hidden');
            }
        }

        // Totais e Observações
        if (document.getElementById('view-budget-total')) {
            document.getElementById('view-budget-total').innerText = `R$ ${parseFloat(budget.total).toFixed(2)}`;
        }
        
        // Observations
        const obsContainer = document.getElementById('view-observations-container');
        const obsText = document.getElementById('view-budget-obs');
        if (obsContainer && obsText) {
            if (budget.observations) {
                obsText.innerText = budget.observations;
                obsContainer.classList.remove('hidden');
            } else {
                obsContainer.classList.add('hidden');
            }
        }

        // Work to be done
        const workContainer = document.getElementById('view-work-container');
        const workText = document.getElementById('view-budget-work');
        if (workContainer && workText) {
            if (budget.work) {
                workText.innerText = budget.work;
                workContainer.classList.remove('hidden');
            } else {
                workContainer.classList.add('hidden');
            }
        }

        // Configurar Ações
        const actionBtn = document.getElementById('view-budget-action-btn');
        if (actionBtn) {
            actionBtn.onclick = (e) => this.openPublicBudget(budget.id, e);
        }

        const approveBtn = document.getElementById('admin-approve-budget');
        const rejectBtn = document.getElementById('admin-reject-budget');
        if (approveBtn) approveBtn.onclick = () => this.updateBudgetStatus(budget.id, 'Aprovado');
        if (rejectBtn) rejectBtn.onclick = () => this.updateBudgetStatus(budget.id, 'Rejeitado');

        this.openModal('modal-budget-view');
        if (window.lucide) window.lucide.createIcons();
    },

    editBudget(id) {
        const budget = Storage.getBudgets().find(b => b.id === id);
        if (!budget) return;

        const form = document.getElementById('form-orcamento');
        if (form) {
            form.dataset.editId = id;
            document.getElementById('budget-id').value = id;
            document.getElementById('budget-client-name').value = budget.clientName || '';
            document.getElementById('budget-client-doc').value = budget.clientDoc || '';
            document.getElementById('budget-client-phone').value = budget.clientPhone || '';
            document.getElementById('budget-client-email').value = budget.clientEmail || '';
            document.getElementById('budget-client-address').value = budget.clientAddress || '';
            document.getElementById('budget-validity').value = budget.validity || '';
            document.getElementById('budget-execution-date').value = budget.executionDate || '';
            document.getElementById('budget-work').value = budget.work || '';
            document.getElementById('budget-observations').value = budget.observations || '';

            // Veículo
            if (budget.vehicle) {
                document.getElementById('budget-vehicle-plate').value = budget.vehicle.plate || '';
                document.getElementById('budget-vehicle-model').value = budget.vehicle.model || '';
                document.getElementById('budget-vehicle-year').value = budget.vehicle.year || '';
                document.getElementById('budget-vehicle-color').value = budget.vehicle.color || '';
                document.getElementById('budget-vehicle-km').value = budget.vehicle.km || '';
            }

            this.budgetItems = [...budget.items];
            this.renderBudgetItems();
            this.currentBudgetStep = 1;
            this.showBudgetStep(1);
            document.getElementById('budget-modal-title').innerText = 'Editar Orçamento';
            this.openModal('modal-orcamento');
        }
    },

    async updateBudgetStatus(id, status) {
        if (!confirm(`Deseja realmente marcar este orçamento como ${status}?`)) return;
        
        try {
            const budgets = Storage.getBudgets();
            const budget = budgets.find(b => b.id === id);
            if (budget) {
                budget.status = status;
                await Storage.saveItem(Storage.KEYS.BUDGETS, budget);
                alert(`Orçamento ${status} com sucesso!`);
                this.loadOrcamentos();
                this.viewBudget(id);
            }
        } catch (e) {
            alert('Erro ao atualizar status: ' + e.message);
        }
    },

    viewOrder(id) {
        const order = Storage.getOrders().find(o => o.id === id);
        if (!order) return;

        this.currentViewingOrder = order;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setVal('view-order-number', `Pedido #${order.number}`);
        setVal('view-order-client-name', order.clientName);
        setVal('view-order-client-phone', order.clientPhone || 'Sem telefone');
        setVal('view-order-client-email', order.clientEmail || 'Sem e-mail');
        
        const statusEl = document.getElementById('view-order-status');
        if (statusEl) {
            statusEl.innerText = order.status;
            statusEl.className = `px-2 py-1 text-[10px] font-bold rounded-full ${
                order.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' :
                order.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
            }`;
        }
        
        setVal('view-order-date', order.date);
        setVal('view-order-total', `R$ ${parseFloat(order.total).toFixed(2)}`);

        const itemsContainer = document.getElementById('view-order-items');
        if (itemsContainer) {
            itemsContainer.innerHTML = (order.items || []).map(item => `
                <div class="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                        <p class="text-sm font-bold text-gray-900 dark:text-white">${item.name}</p>
                        <p class="text-[10px] text-gray-500">${item.qty}x R$ ${parseFloat(item.price).toFixed(2)}</p>
                    </div>
                    <span class="text-sm font-black text-gray-900 dark:text-white">R$ ${(item.qty * item.price).toFixed(2)}</span>
                </div>
            `).join('');
        }

        const approveBtn = document.getElementById('btn-approve-order');
        const rejectBtn = document.getElementById('btn-reject-order');
        if (approveBtn) approveBtn.onclick = () => this.updateOrderStatus(order.id, 'Aprovado');
        if (rejectBtn) rejectBtn.onclick = () => this.updateOrderStatus(order.id, 'Cancelado');

        this.openModal('modal-order-view');
        if (window.lucide) window.lucide.createIcons();
    },

    async updateOrderStatus(id, status) {
        if (!confirm(`Deseja realmente alterar o status para ${status}?`)) return;
        try {
            const orders = Storage.getOrders();
            const orderIndex = orders.findIndex(o => o.id === id);
            if (orderIndex !== -1) {
                orders[orderIndex].status = status;
                await Storage.saveItem(Storage.KEYS.ORDERS, orders[orderIndex]);
                alert('Status atualizado!');
                this.loadOrders();
                this.viewOrder(id);
            }
        } catch (e) {
            alert('Erro: ' + e.message);
        }
    },

    async exportOrderPDF() {
        alert('Exportação de PDF do pedido em desenvolvimento.');
    },

    async exportFullReport(type, e) {
        if (e && e.preventDefault) e.preventDefault();
        
        const btn = e ? e.currentTarget : null;
        let originalContent = '';
        
        if (btn) {
            originalContent = btn.innerHTML;
            btn.classList.add('opacity-50', 'pointer-events-none');
            btn.innerHTML = '<i class="w-4 h-4 animate-spin" data-lucide="loader-2"></i> Processando...';
            if (window.lucide) window.lucide.createIcons();
        }

        const stats = Storage.getDashboardStats();
        const settings = Storage.getSettings();
        const date = new Date().toLocaleDateString('pt-BR');

        try {
            if (type === 'pdf') {
                if (!window.jspdf) {
                    alert('Biblioteca PDF ainda não carregada. Aguarde um momento...');
                    return;
                }
                
                // Pequeno delay para feedback visual
                await new Promise(resolve => setTimeout(resolve, 600));

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Cabeçalho Profissional
                doc.setFillColor(37, 99, 235); // Blue-600
                doc.rect(0, 0, 210, 40, 'F');
                
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(24);
                doc.setFont('helvetica', 'bold');
                doc.text(settings.companyName || 'Relatório de Gestão', 105, 25, { align: 'center' });
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`Data de Emissão: ${date}`, 105, 33, { align: 'center' });
                
                // Corpo do Relatório
                doc.setTextColor(31, 41, 55); // Gray-800
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text('Resumo Executivo', 20, 60);
                
                doc.setDrawColor(229, 231, 235);
                doc.line(20, 65, 190, 65);
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                
                const billingFormatted = parseFloat(stats.billing || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                let y = 80;
                const drawMetric = (label, value) => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(label + ':', 25, y);
                    doc.setFont('helvetica', 'normal');
                    doc.text(String(value), 80, y);
                    y += 12;
                };

                drawMetric('Faturamento Mensal', billingFormatted);
                drawMetric('Orçamentos Pendentes', stats.budgetsCount);
                drawMetric('Total de Clientes', stats.clientsCount);
                drawMetric('Serviços no Catálogo', stats.servicesCount);

                // Rodapé
                doc.setFontSize(10);
                doc.setTextColor(156, 163, 175); // Gray-400
                doc.text('Gerado automaticamente pelo Sistema de Gestão Pro', 105, 285, { align: 'center' });
                
                doc.save(`relatorio_gestao_${date.replace(/\//g, '-')}.pdf`);
            } else if (type === 'excel') {
                // Pequeno delay para feedback visual
                await new Promise(resolve => setTimeout(resolve, 800));

                const rows = [
                    ['Relatório Geral', settings.companyName],
                    ['Data', date],
                    [''],
                    ['Métrica', 'Valor'],
                    ['Faturamento Total', stats.billing],
                    ['Total Orçamentos', stats.budgetsCount],
                    ['Total Clientes', stats.clientsCount],
                    ['Total Serviços', stats.servicesCount]
                ];

                // Usar ponto e vírgula para maior compatibilidade com Excel em PT-BR
                const csvContent = "\uFEFF" + rows.map(e => e.join(";")).join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `relatorio_gestao_${date.replace(/\//g, '-')}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error('Erro ao exportar:', err);
            alert('Erro ao processar a exportação.');
        } finally {
            if (btn) {
                btn.innerHTML = originalContent;
                btn.classList.remove('opacity-50', 'pointer-events-none');
                if (window.lucide) window.lucide.createIcons();
            }
        }
    },

    exportBudgetPDF(id) {
        const budget = id ? Storage.getBudgets().find(b => b.id === id) : this.currentViewingBudget;
        if (!budget) return;

        const settings = Storage.getSettings();
        const date = new Date().toLocaleDateString('pt-BR');

        if (!window.jspdf) {
            alert('Biblioteca PDF ainda não carregada.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cabeçalho
        doc.setFillColor(31, 41, 55);
        doc.rect(0, 0, 210, 45, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.companyName || 'Orçamento', 20, 25);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Orçamento #${budget.number}`, 20, 35);
        doc.text(`Data: ${budget.date}`, 180, 25, { align: 'right' });
        doc.text(`Status: ${budget.status}`, 180, 35, { align: 'right' });

        // Dados do Prestador e Cliente
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Dados do Prestador', 20, 60);
        doc.text('Dados do Cliente', 110, 60);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text([
            settings.companyName,
            `CNPJ: ${settings.cnpj || '-'}`,
            `Fone: ${settings.phone || '-'}`,
            settings.address || ''
        ], 20, 68);

        doc.text([
            budget.clientName,
            `Doc: ${budget.clientDoc || '-'}`,
            `Fone: ${budget.clientPhone || '-'}`,
            budget.clientAddress || ''
        ], 110, 68);

        // Veículo
        if (budget.vehicle && budget.vehicle.plate) {
            doc.setFillColor(243, 244, 246);
            doc.rect(20, 95, 170, 15, 'F');
            doc.setFont('helvetica', 'bold');
            doc.text(`Veículo: ${budget.vehicle.model} | Placa: ${budget.vehicle.plate} | Cor: ${budget.vehicle.color}`, 25, 104);
        }

        // Tabela de Itens
        let y = (budget.vehicle && budget.vehicle.plate) ? 120 : 100;
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(229, 231, 235);
        doc.rect(20, y, 170, 8, 'F');
        doc.text('Item', 25, y + 6);
        doc.text('Qtd', 130, y + 6);
        doc.text('Valor', 150, y + 6);
        doc.text('Total', 175, y + 6);

        y += 12;
        doc.setFont('helvetica', 'normal');
        budget.items.forEach(item => {
            const totalItem = (parseFloat(item.price) * (item.qty || 1)).toFixed(2);
            doc.text(item.name.substring(0, 40), 25, y);
            doc.text(String(item.qty || 1), 133, y, { align: 'center' });
            doc.text(parseFloat(item.price).toFixed(2), 158, y, { align: 'right' });
            doc.text(totalItem, 185, y, { align: 'right' });
            y += 8;

            if (y > 270) {
                doc.addPage();
                y = 20;
            }
        });

        // Totais
        y += 10;
        doc.setDrawColor(229, 231, 235);
        doc.line(20, y, 190, y);
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('VALOR TOTAL:', 130, y);
        doc.text(`R$ ${parseFloat(budget.total).toFixed(2)}`, 190, y, { align: 'right' });

        doc.save(`orcamento_${budget.number}.pdf`);
    },

    async saveFinance(e) {
        e.preventDefault();
        const typeEl = document.getElementById('finance-type');
        const descEl = document.getElementById('finance-description');
        const catEl = document.getElementById('finance-category');
        const amountEl = document.getElementById('finance-amount');
        const statusEl = document.getElementById('finance-status');

        if (!typeEl || !descEl || !catEl || !amountEl) return;

        const rawType = typeEl.value;
        const type = rawType === 'entrada' ? 'Receita' : 'Despesa';
        const description = descEl.value;
        const category = catEl.value;
        const valueStr = amountEl.value;
        const status = statusEl ? statusEl.value : 'Pago';

        const value = this.cleanMoney(valueStr);

        const movement = {
            id: Date.now().toString(),
            type,
            description,
            category,
            value,
            status,
            date: new Date().toLocaleDateString('pt-BR'),
            paymentMethod: 'Dinheiro'
        };

        try {
            await Storage.saveItem(Storage.KEYS.MOVEMENTS, movement);
            alert('Movimentação salva com sucesso!');
            e.target.reset();
            this.closeModal('modal-finance');
            this.loadFinanceiro();
            this.loadDashboard();
        } catch (e) {
            alert('Erro ao salvar movimentação: ' + e.message);
        }
    },

    editUser(id) {
        const user = Storage.getUsers().find(u => u.id === id);
        if (!user) return;

        document.getElementById('user-id').value = user.id;
        document.getElementById('user-name').value = user.name || '';
        document.getElementById('user-login').value = user.user || user.login || '';
        document.getElementById('user-password').value = user.pass || '';
        document.getElementById('user-role').value = user.role || 'Operador';

        // Permissions
        const perms = user.permissions || {};
        document.querySelectorAll('#form-usuario input[name="perm"]').forEach(cb => {
            cb.checked = !!perms[cb.value];
        });

        const title = document.querySelector('#modal-usuario h3');
        if (title) title.innerText = 'Editar Usuário';
        this.openModal('modal-usuario');
    },

    async saveUser(e) {
        if (e) e.preventDefault();
        
        const id = document.getElementById('user-id').value;
        const name = document.getElementById('user-name').value;
        const login = document.getElementById('user-login').value;
        const pass = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;

        if (!name || !login || !pass || !role) {
            alert('Por favor, preencha todos os campos obrigatórios (Nome, Usuário, Senha e Cargo).');
            return;
        }

        // Permissions gathering
        const permissions = {};
        document.querySelectorAll('#form-usuario input[name="perm"]').forEach(cb => {
            permissions[cb.value] = cb.checked;
        });

        const userData = {
            id: id || Date.now().toString(),
            name,
            user: login, // mantendo compatibilidade com 'user' e 'login'
            login,
            pass,
            role,
            status: 'Ativo', // Default
            permissions
        };

        try {
            await Storage.saveItem(Storage.KEYS.USERS, userData);
            alert(id ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
            this.closeModal('modal-usuario');
            this.loadUsuarios();
        } catch (err) {
            console.error('Erro ao salvar usuário:', err);
            alert('Erro ao salvar usuário: ' + err.message);
        }
    },

    async saveOrcamento(e) {
        if (e) e.preventDefault();
        
        // Final Validations
        const clientName = document.getElementById('budget-client-name').value;
        const executionDate = document.getElementById('budget-execution-date').value;
        const work = document.getElementById('budget-work').value;
        const observations = document.getElementById('budget-observations').value;

        if (!clientName || !executionDate || !work || !observations) {
            alert('Por favor, preencha todos os campos obrigatórios: Nome do Cliente, Prazo de Execução, O que será feito e Observações.');
            this.currentBudgetStep = 1;
            this.showBudgetStep(1);
            return;
        }

        if (this.budgetItems.length === 0) {
            alert('Adicione pelo menos um item ao orçamento!');
            this.currentBudgetStep = 2;
            this.showBudgetStep(2);
            return;
        }

        const editId = document.getElementById('budget-id').value;
        let number;
        let status = 'Pendente';

        if (editId) {
            const existing = Storage.getBudgets().find(b => b.id === editId);
            if (existing) {
                number = existing.number;
                status = existing.status;
            } else {
                number = await Storage.getNextNumber('ORC');
            }
        } else {
            number = await Storage.getNextNumber('ORC');
        }

        const total = this.budgetItems.reduce((acc, curr) => acc + (parseFloat(curr.price || 0) * curr.qty), 0);

        const budget = {
            id: editId || Date.now().toString(),
            number, clientName,
            clientDoc: document.getElementById('budget-client-doc').value,
            clientPhone: document.getElementById('budget-client-phone').value,
            clientEmail: document.getElementById('budget-client-email').value,
            clientAddress: document.getElementById('budget-client-address').value,
            date: new Date().toLocaleDateString('pt-BR'),
            validity: document.getElementById('budget-validity').value,
            executionDate: document.getElementById('budget-execution-date').value,
            work: document.getElementById('budget-work').value,
            observations: document.getElementById('budget-observations').value,
            items: this.budgetItems,
            total,
            status,
            vehicle: {
                plate: document.getElementById('budget-vehicle-plate').value,
                model: document.getElementById('budget-vehicle-model').value,
                year: document.getElementById('budget-vehicle-year').value,
                color: document.getElementById('budget-vehicle-color').value,
                km: document.getElementById('budget-vehicle-km').value
            }
        };

        try {
            await Storage.saveItem(Storage.KEYS.BUDGETS, budget);
            alert('Orçamento salvo com sucesso!');
            this.closeModal('modal-orcamento');
            this.loadOrcamentos();
            this.loadDashboard();
            this.budgetItems = [];
            this.currentBudgetStep = 1;
        } catch (e) {
            alert('Erro ao salvar orçamento: ' + e.message);
        }
    },

    getPublicStoreUrl() {
        const settings = Storage.getSettings();
        const slug = settings.storeSlug || 'loja-geral';
        const baseUrl = window.location.href.split('#')[0];
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        return `${cleanBaseUrl}/#loja/${slug}`;
    },

    openPublicStore(e) {
        if (e && e.preventDefault) e.preventDefault();
        const url = this.getPublicStoreUrl();
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    copyBudgetLink(id) {
        const baseUrl = window.location.href.split('#')[0];
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const url = `${cleanBaseUrl}/#orcamento/${id}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Link do orçamento copiado!');
        });
    },

    openPublicBudget(id, e) {
        if (e && e.preventDefault) e.preventDefault();
        const baseUrl = window.location.href.split('#')[0];
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const url = `${cleanBaseUrl}/#orcamento/${id}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    sharePublicStore() {
        const settings = Storage.getSettings();
        const url = this.getPublicStoreUrl();
        if (navigator.share) {
            navigator.share({
                title: settings.companyName || 'Minha Loja',
                text: 'Confira nossa vitrine online!',
                url: url
            }).catch(console.error);
        } else {
            this.copyPublicStoreLink();
        }
    },

    copyPublicStoreLink() {
        const url = this.getPublicStoreUrl();
        navigator.clipboard.writeText(url).then(() => {
            alert('Link da loja copiado para a área de transferência!');
        });
    },

    showPublicView(page) {
        console.log('Exibindo vista pública:', page);
        const appShell = document.getElementById('app-shell');
        const loginScreen = document.getElementById('login-screen');
        if (appShell) appShell.classList.add('hidden');
        if (loginScreen) loginScreen.classList.add('hidden');
        
        const loader = document.getElementById('public-loader');
        if (loader) loader.classList.add('hidden');

        if (page.startsWith('orcamento/')) {
            const id = page.split('/')[1];
            this.renderPublicBudget(id);
            const budgetView = document.getElementById('public-budget-view');
            if (budgetView) {
                budgetView.classList.remove('hidden');
                budgetView.style.display = 'block';
            }
        } else if (page.startsWith('loja')) {
            this.renderPublicStore();
            const storeView = document.getElementById('public-store-view');
            if (storeView) {
                storeView.classList.remove('hidden');
                storeView.style.display = 'block';
            }
        }
    },

    async renderPublicBudget(id) {
        const content = document.getElementById('public-budget-content');
        if (!content) return;

        // Tentar buscar do storage primeiro (se já sincronizou) ou buscar direto do Firebase se necessário
        let budget = Storage.getBudgets().find(b => b.id === id);
        
        if (!budget) {
            content.innerHTML = `
                <div class="p-20 text-center">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="search" class="w-8 h-8 text-gray-400"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900">Orçamento não encontrado</h3>
                    <p class="text-gray-500 mt-2">O link pode estar incorreto ou o orçamento foi removido.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const settings = Storage.getSettings();
        
        content.innerHTML = `
            <div class="p-8 md:p-12">
                <div class="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-gray-100 pb-10 mb-10">
                    <div>
                        <div class="flex items-center gap-3 mb-4">
                            ${settings.logo ? `<img src="${settings.logo}" class="h-12 w-auto object-contain">` : `<div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">G</div>`}
                            <h1 class="text-2xl font-black uppercase tracking-tight text-gray-900">${settings.companyName || 'Gestão Pro'}</h1>
                        </div>
                        <div class="space-y-1">
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Informações de Contato</p>
                            <p class="text-sm font-bold text-gray-600">${settings.address || ''}</p>
                            <p class="text-sm font-bold text-gray-600">${settings.phone || ''} | ${settings.whatsapp || ''}</p>
                            <p class="text-sm font-bold text-gray-600">${settings.cnpj || ''}</p>
                        </div>
                    </div>
                    <div class="text-left md:text-right">
                        <span class="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-2">Orçamento Oficial</span>
                        <h2 class="text-4xl font-black text-gray-900 tracking-tight">#${budget.number}</h2>
                        <p class="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">Data: ${budget.date}</p>
                        <div class="mt-4">
                            <span class="badge ${budget.status === 'Aprovado' ? 'badge-success' : (budget.status === 'Rejeitado' ? 'badge-danger' : 'badge-warning')}">${budget.status}</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                    <div>
                        <h3 class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Dados do Cliente</h3>
                        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                            <p class="text-xl font-black text-gray-900 mb-1">${budget.clientName}</p>
                            <p class="text-sm font-bold text-gray-500">${budget.clientDoc || ''}</p>
                            <div class="mt-4 pt-4 border-t border-gray-200/50 space-y-2">
                                <p class="text-sm text-gray-600 flex items-center gap-2"><i data-lucide="phone" class="w-3.5 h-3.5"></i> ${budget.clientPhone || ''}</p>
                                <p class="text-sm text-gray-600 flex items-center gap-2"><i data-lucide="mail" class="w-3.5 h-3.5"></i> ${budget.clientEmail || ''}</p>
                                <p class="text-sm text-gray-600 flex items-center gap-2"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i> ${budget.clientAddress || ''}</p>
                            </div>
                        </div>
                    </div>
                    ${budget.vehicle && budget.vehicle.plate ? `
                    <div>
                        <h3 class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Informações Adicionais</h3>
                        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Veículo</p>
                                    <p class="text-sm font-bold text-gray-900">${budget.vehicle.model}</p>
                                </div>
                                <div>
                                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Placa</p>
                                    <p class="text-sm font-bold text-gray-900">${budget.vehicle.plate}</p>
                                </div>
                                <div>
                                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">KM</p>
                                    <p class="text-sm font-bold text-gray-900">${budget.vehicle.km}</p>
                                </div>
                                <div>
                                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cor</p>
                                    <p class="text-sm font-bold text-gray-900">${budget.vehicle.color}</p>
                                </div>
                            </div>
                        </div>
                    </div>` : ''}
                </div>

                <div class="mb-12">
                    <h3 class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Itens do Orçamento</h3>
                    <div class="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Descrição</th>
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Qtd</th>
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Unitário</th>
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${budget.items.map(item => `
                                    <tr>
                                        <td class="px-6 py-5">
                                            <p class="text-sm font-bold text-gray-900">${item.name}</p>
                                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${item.type === 'service' ? 'Serviço' : 'Produto'}</p>
                                        </td>
                                        <td class="px-6 py-5 text-center text-sm font-bold text-gray-600">${item.qty}</td>
                                        <td class="px-6 py-5 text-right text-sm font-bold text-gray-600">R$ ${parseFloat(item.price).toFixed(2)}</td>
                                        <td class="px-6 py-5 text-right text-sm font-black text-gray-900">R$ ${(parseFloat(item.price) * item.qty).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot class="bg-gray-50/50">
                                <tr>
                                    <td colspan="3" class="px-6 py-6 text-right">
                                        <span class="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Total Geral</span>
                                    </td>
                                    <td class="px-6 py-6 text-right">
                                        <span class="text-2xl font-black text-blue-600">R$ ${parseFloat(budget.total).toFixed(2)}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                ${budget.observations ? `
                <div class="mb-12 p-8 bg-blue-50/30 rounded-3xl border border-blue-100/50">
                    <h3 class="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-3">Observações</h3>
                    <p class="text-sm text-blue-900 font-medium leading-relaxed">${budget.observations}</p>
                </div>` : ''}

                ${budget.status === 'Pendente' ? `
                <div class="flex flex-col sm:flex-row gap-4 no-print">
                    <button onclick="ui.updatePublicBudgetStatus('${budget.id}', 'Aprovado')" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-green-500/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                        <i data-lucide="check-circle" class="w-5 h-5"></i> Aprovar Orçamento
                    </button>
                    <button onclick="ui.updatePublicBudgetStatus('${budget.id}', 'Rejeitado')" class="flex-1 bg-white hover:bg-gray-50 text-red-600 border-2 border-red-100 font-black py-5 rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center gap-3">
                        <i data-lucide="x-circle" class="w-5 h-5"></i> Rejeitar
                    </button>
                </div>` : `
                <div class="p-8 bg-gray-50 rounded-3xl text-center border border-gray-100">
                    <p class="text-sm font-bold text-gray-500 uppercase tracking-widest">Este orçamento foi <span class="${budget.status === 'Aprovado' ? 'text-green-600' : 'text-red-600'}">${budget.status}</span> em ${new Date().toLocaleDateString('pt-BR')}</p>
                    <button onclick="ui.exportBudgetPDF('${budget.id}')" class="mt-4 text-blue-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
                        <i data-lucide="file-text" class="w-4 h-4"></i> Exportar Orçamento em PDF
                    </button>
                </div>`}
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    },

    async updatePublicBudgetStatus(id, status) {
        if (!confirm(`Deseja realmente ${status === 'Aprovado' ? 'APROVAR' : 'REJEITAR'} este orçamento?`)) return;
        
        try {
            const budgets = Storage.getBudgets();
            const budget = budgets.find(b => b.id === id);
            if (budget) {
                budget.status = status;
                await Storage.saveItem(Storage.KEYS.BUDGETS, budget);
                alert(`Orçamento ${status} com sucesso!`);
                this.renderPublicBudget(id);
            }
        } catch (e) {
            alert('Erro ao atualizar status: ' + e.message);
        }
    },

    // Search and Filters
    filterClients(query) {
        this.loadClientes(query);
    },

    filterBudgetItems(type) {
        const query = document.getElementById(`search-${type}`).value.toLowerCase();
        const resultsEl = document.getElementById(`${type}-results`);
        if (!resultsEl) return;

        if (!query) {
            resultsEl.classList.add('hidden');
            return;
        }

        const items = type === 'services' ? Storage.getServices() : Storage.getProducts();
        const filtered = items.filter(i => i.name.toLowerCase().includes(query));

        if (filtered.length > 0) {
            resultsEl.classList.remove('hidden');
            resultsEl.innerHTML = filtered.map(item => `
                <div onclick="ui.addItemToBudget('${type}', '${item.id}')" class="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <p class="text-sm font-bold text-gray-900 dark:text-white">${item.name}</p>
                    <p class="text-xs text-gray-500">R$ ${parseFloat(item.price).toFixed(2)}</p>
                </div>
            `).join('');
        } else {
            resultsEl.innerHTML = '<div class="p-4 text-center text-xs text-gray-400 font-bold uppercase">Nenhum resultado</div>';
        }
    },

    addItemToBudget(type, id) {
        const item = (type === 'services' ? Storage.getServices() : Storage.getProducts()).find(i => i.id === id);
        if (item) {
            this.budgetItems.push({
                ...item,
                type,
                qty: 1,
                total: parseFloat(item.price)
            });
            document.getElementById(`search-${type}`).value = '';
            document.getElementById(`${type}-results`).classList.add('hidden');
            this.updateBudgetSummary();
        }
    },

    updateBudgetSummary() {
        const subtotal = this.budgetItems.reduce((acc, item) => acc + item.total, 0);
        const discountInput = document.getElementById('budget-discount');
        const discount = discountInput ? parseFloat(discountInput.value || 0) : 0;
        const total = subtotal - discount;

        const subEl = document.getElementById('budget-subtotal');
        const totEl = document.getElementById('budget-total');

        if (subEl) subEl.innerText = `R$ ${subtotal.toFixed(2)}`;
        if (totEl) totEl.innerText = `R$ ${total.toFixed(2)}`;

        this.renderBudgetItems();
    },

    renderBudgetItems() {
        const container = document.getElementById('budget-items-list');
        if (!container) return;

        if (this.budgetItems.length === 0) {
            container.innerHTML = `
                <div class="py-12 flex flex-col items-center justify-center text-center opacity-40">
                    <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="shopping-bag" class="w-8 h-8 text-gray-400"></i>
                    </div>
                    <p class="text-xs font-black uppercase tracking-widest text-gray-400">Seu orçamento está vazio</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.budgetItems.map((item, index) => `
            <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl ${item.type === 'services' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'} flex items-center justify-center">
                        <i data-lucide="${item.type === 'services' ? 'wrench' : 'package'}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-gray-900 dark:text-white">${item.name}</p>
                        <p class="text-[10px] font-black text-gray-400 uppercase">R$ ${parseFloat(item.price).toFixed(2)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button onclick="ui.updateBudgetItemQty(${index}, -1)" class="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"><i data-lucide="minus" class="w-3 h-3"></i></button>
                        <span class="px-3 text-xs font-bold">${item.qty}</span>
                        <button onclick="ui.updateBudgetItemQty(${index}, 1)" class="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"><i data-lucide="plus" class="w-3 h-3"></i></button>
                    </div>
                    <button onclick="ui.removeBudgetItem(${index})" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    updateBudgetItemQty(index, delta) {
        const item = this.budgetItems[index];
        item.qty = Math.max(1, item.qty + delta);
        item.total = item.qty * parseFloat(item.price);
        this.updateBudgetSummary();
    },

    removeBudgetItem(index) {
        this.budgetItems.splice(index, 1);
        this.updateBudgetSummary();
    },

    // Settings & Logo
    handleFileUpload(e, previewId) {
        const file = e.target.files[0];
        if (!file) return;

        // Reduzido para 500KB para garantir compatibilidade com Firestore (limite de 1MB por documento)
        // e evitar lentidão excessiva no upload de Base64
        if (file.size > 500 * 1024) {
            alert('Arquivo muito grande! O limite para logo/favicon é de 500KB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            const preview = document.getElementById(previewId);
            const placeholderId = previewId.replace('-preview', '-placeholder');
            const btnRemoveId = previewId.replace('-preview', '');
            const placeholder = document.getElementById(placeholderId);
            const btnRemove = document.getElementById('btn-remove-' + (previewId.includes('logo') ? 'logo' : 'favicon'));
            
            if (preview) {
                preview.src = base64;
                preview.classList.remove('hidden');
            }
            
            if (placeholder) placeholder.classList.add('hidden');
            if (btnRemove) btnRemove.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    },

    removeLogo() {
        const preview = document.getElementById('settings-logo-preview');
        const placeholder = document.getElementById('settings-logo-placeholder');
        const btnRemove = document.getElementById('btn-remove-logo');

        if (preview) {
            preview.src = '';
            preview.classList.add('hidden');
        }
        if (placeholder) placeholder.classList.remove('hidden');
        if (btnRemove) btnRemove.classList.add('hidden');

        const settings = Storage.getSettings();
        settings.logo = null;
        Storage.saveItem(Storage.KEYS.SETTINGS, settings);
    },

    removeFavicon() {
        const preview = document.getElementById('settings-favicon-preview');
        const placeholder = document.getElementById('settings-favicon-placeholder');
        const btnRemove = document.getElementById('btn-remove-favicon');

        if (preview) {
            preview.src = '';
            preview.classList.add('hidden');
        }
        if (placeholder) placeholder.classList.remove('hidden');
        if (btnRemove) btnRemove.classList.add('hidden');

        const settings = Storage.getSettings();
        settings.favicon = null;
        Storage.saveItem(Storage.KEYS.SETTINGS, settings);
        this.updateFavicon(null);
    },

    handleColorChange(val) {
        document.documentElement.style.setProperty('--brand', val);
        
        // Sincronizar inputs
        const colorInput = document.getElementById('settings-primary-color');
        const textInput = document.getElementById('settings-primary-color-text');
        const hexDisplay = document.getElementById('primary-color-hex');
        
        if (colorInput && colorInput.value !== val) colorInput.value = val;
        if (textInput && textInput.value !== val) textInput.value = val;
        if (hexDisplay) hexDisplay.innerText = val.toUpperCase();
        
        // NÃO salvar no Firebase aqui para evitar lentidão
        // O salvamento ocorrerá no formulário principal
    },

    handleProductUnitChange() {
        console.log('Unit changed');
    },

    async saveCategoria(e) { 
        if (e) e.preventDefault(); 
        
        const idEl = document.getElementById('category-id');
        const nameEl = document.getElementById('category-name');
        const typeEl = document.getElementById('category-type');
        const descEl = document.getElementById('category-description');
        const colorEl = document.getElementById('category-color');
        const iconEl = document.getElementById('category-icon');

        if (!nameEl || !nameEl.value) {
            alert('Por favor, informe o nome da categoria.');
            return;
        }

        const id = idEl ? idEl.value : '';
        const cat = {
            id: id || Date.now().toString(),
            name: nameEl.value,
            type: typeEl ? typeEl.value : 'Produtos',
            description: descEl ? descEl.value : '',
            color: colorEl ? colorEl.value : '#3b82f6',
            icon: iconEl ? iconEl.value : 'tag'
        };

        try {
            await Storage.saveItem(Storage.KEYS.CATEGORIES, cat);
            this.closeModal('modal-categoria');
            this.loadCategorias();
            alert('Categoria salva com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar categoria:', err);
            alert('Erro ao salvar categoria.');
        }
    },

    editCategory(id) {
        const cat = Storage.getCategories().find(c => c.id === id);
        if (!cat) return;

        document.getElementById('modal-categoria-title').innerText = 'Editar Categoria';
        document.getElementById('category-id').value = cat.id;
        document.getElementById('category-name').value = cat.name;
        if (document.getElementById('category-type')) document.getElementById('category-type').value = cat.type || 'Produtos';
        if (document.getElementById('category-description')) document.getElementById('category-description').value = cat.description || '';
        if (document.getElementById('category-color')) document.getElementById('category-color').value = cat.color || '#3b82f6';
        if (document.getElementById('category-icon')) document.getElementById('category-icon').value = cat.icon || 'tag';

        this.openModal('modal-categoria');
    },

    handleStoreSearch() {
        this.renderPublicStore();
    },

    setStoreSection(sec) {
        this.currentStoreSection = sec;
        
        // Update UI Tabs
        const btnProducts = document.getElementById('store-tab-products');
        const btnServices = document.getElementById('store-tab-services');
        
        if (btnProducts && btnServices) {
            if (sec === 'products') {
                btnProducts.classList.add('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
                btnProducts.classList.remove('text-gray-400');
                btnServices.classList.add('text-gray-400');
                btnServices.classList.remove('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
            } else if (sec === 'services') {
                btnServices.classList.add('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
                btnServices.classList.remove('text-gray-400');
                btnProducts.classList.add('text-gray-400');
                btnProducts.classList.remove('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
            } else {
                btnProducts.classList.remove('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm', 'text-gray-400');
                btnServices.classList.remove('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm', 'text-gray-400');
            }
        }

        this.renderPublicStore();
    },

    toggleStoreCart() {
        const overlay = document.getElementById('store-cart-overlay');
        if (overlay) {
            const isHidden = overlay.classList.contains('hidden');
            if (isHidden) {
                this.renderCart();
                overlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            } else {
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    },

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-600' : 'bg-gray-900';
        const icon = type === 'error' ? 'alert-circle' : 'check-circle';
        const iconColor = type === 'error' ? 'text-white' : 'text-green-500';
        
        toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] ${bgColor} text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-300`;
        toast.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i> ${message}</div>`;
        document.body.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();
        
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-10');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    addToCart(id, type) {
        const items = type === 'product' ? Storage.getProducts() : Storage.getServices();
        const item = items.find(i => i.id === id);
        if (!item) return;

        this.storeCart.push({
            ...item,
            cartType: type,
            cartId: Date.now() + Math.random()
        });

        this.updateCartUI();
        this.showToast('Adicionado ao carrinho');
    },

    removeFromCart(cartId) {
        this.storeCart = this.storeCart.filter(item => item.cartId !== cartId);
        this.renderCart();
        this.updateCartUI();
    },

    updateCartUI() {
        const countEls = [
            document.getElementById('store-cart-count'),
            document.getElementById('nav-cart-count')
        ];
        
        const count = this.storeCart.length;
        countEls.forEach(el => {
            if (el) {
                el.innerText = count;
                if (count > 0) el.classList.remove('hidden');
                else el.classList.add('hidden');
            }
        });

        const footer = document.getElementById('store-cart-footer');
        const footerTotalEl = document.getElementById('store-cart-footer-total');
        if (footer) {
            if (count > 0) {
                footer.classList.remove('translate-y-32', 'opacity-0', 'pointer-events-none');
                const total = this.storeCart.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);
                if (footerTotalEl) footerTotalEl.innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                footer.classList.add('translate-y-32', 'opacity-0', 'pointer-events-none');
            }
        }
    },

    renderCart() {
        const container = document.getElementById('store-cart-items');
        const countEl = document.getElementById('store-cart-items-count');
        if (!container) return;

        countEl.innerText = `${this.storeCart.length} itens selecionados`;

        if (this.storeCart.length === 0) {
            container.innerHTML = `
                <div class="py-12 text-center">
                    <i data-lucide="shopping-bag" class="w-12 h-12 text-gray-200 mx-auto mb-4"></i>
                    <p class="text-sm font-bold text-gray-400 uppercase tracking-widest">Carrinho vazio</p>
                </div>
            `;
            this.updateCartTotals(0, 0, 0);
        } else {
            let productsSub = 0;
            let servicesSub = 0;
            let totalTime = 0;

            container.innerHTML = this.storeCart.map(item => {
                const price = parseFloat(item.price) || 0;
                if (item.cartType === 'product') productsSub += price;
                else {
                    servicesSub += price;
                    totalTime += parseInt(item.time) || 0;
                }

                return `
                    <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div class="w-12 h-12 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center text-blue-600 font-black">
                            ${item.cartType === 'product' ? '<i data-lucide="package"></i>' : '<i data-lucide="wrench"></i>'}
                        </div>
                        <div class="flex-1">
                            <h4 class="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">${item.name}</h4>
                            <p class="text-[10px] font-bold text-blue-600">${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <button onclick="ui.removeFromCart(${item.cartId})" class="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
            }).join('');

            this.updateCartTotals(productsSub, servicesSub, totalTime);
        }
        if (window.lucide) window.lucide.createIcons();
    },

    updateCartTotals(products, services, time) {
        const prodEl = document.getElementById('store-cart-products-subtotal');
        const servEl = document.getElementById('store-cart-services-subtotal');
        const timeEl = document.getElementById('store-cart-estimated-time');
        const totalEl = document.getElementById('store-cart-total');

        if (prodEl) prodEl.innerText = products.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (servEl) servEl.innerText = services.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (timeEl) timeEl.innerText = `${time} min`;
        if (totalEl) totalEl.innerText = (products + services).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    openStoreCheckout() {
        const overlay = document.getElementById('store-checkout-overlay');
        if (overlay) overlay.classList.remove('hidden');
    },

    closeStoreCheckout() {
        const overlay = document.getElementById('store-checkout-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    async submitStoreOrder(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando...';
            if (window.lucide) window.lucide.createIcons();
        }

        const name = document.getElementById('store-client-name').value;
        const phone = document.getElementById('store-client-phone').value;
        
        // Simular envio
        await new Promise(resolve => setTimeout(resolve, 1500));

        alert(`Obrigado, ${name}! Sua solicitação de orçamento foi enviada. Entraremos em contato em breve no número ${phone}.`);
        
        this.storeCart = [];
        this.updateCartUI();
        this.closeStoreCheckout();
        this.toggleStoreCart();
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Enviar Solicitação';
        }
    },

    renderPublicStore() {
        const content = document.getElementById('store-content');
        const nameEl = document.getElementById('store-name');
        const logoEl = document.getElementById('store-logo');
        const logoPlaceholder = document.getElementById('store-logo-placeholder');
        const searchInput = document.getElementById('store-search');
        
        if (!content) return;

        const settings = Storage.getSettings();
        const products = Storage.getProducts();
        const services = Storage.getServices();
        const categories = Storage.getCategories();

        if (nameEl) nameEl.innerText = settings.companyName || 'Nossa Loja';
        
        // Tab Title and Favicon based on settings
        if (settings.tabTitle) document.title = settings.tabTitle;

        if (settings.logo) {
            if (logoEl) {
                logoEl.src = settings.logo;
                logoEl.classList.remove('hidden');
            }
            if (logoPlaceholder) logoPlaceholder.classList.add('hidden');
        }

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        let filteredItems = [];
        if (this.currentStoreSection === 'all') {
            filteredItems = [
                ...products.map(p => ({ ...p, type: 'product' })),
                ...services.map(s => ({ ...s, type: 'service' }))
            ];
        } else if (this.currentStoreSection === 'products') {
            filteredItems = products.map(p => ({ ...p, type: 'product' }));
        } else if (this.currentStoreSection === 'services') {
            filteredItems = services.map(s => ({ ...s, type: 'service' }));
        } else {
            // Filtrar por categoria ID
            filteredItems = [
                ...products.map(p => ({ ...p, type: 'product' })),
                ...services.map(s => ({ ...s, type: 'service' }))
            ].filter(i => i.category === this.currentStoreSection);
        }

        if (searchTerm) {
            filteredItems = filteredItems.filter(i => 
                (i.name && i.name.toLowerCase().includes(searchTerm)) || 
                (i.description && i.description.toLowerCase().includes(searchTerm))
            );
        }

        if (filteredItems.length === 0) {
            content.innerHTML = `
                <div class="py-20 text-center w-full">
                    <div class="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="search-x" class="w-10 h-10 text-gray-300"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-400 uppercase tracking-widest">Nenhum item disponível</p>
                </div>
            `;
        } else {
            content.innerHTML = filteredItems.map(item => `
                <div class="bg-white dark:bg-[#111827] rounded-[32px] p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
                            ${item.type === 'product' ? '<i data-lucide="package" class="w-7 h-7"></i>' : '<i data-lucide="wrench" class="w-7 h-7"></i>'}
                        </div>
                        <div class="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                            ${item.type === 'product' ? 'Produto' : 'Serviço'}
                        </div>
                    </div>
                    
                    <h3 class="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1 truncate">${item.name}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 h-8 leading-relaxed">${item.description || 'Qualidade garantida para você.'}</p>
                    
                    <div class="flex items-center justify-between mt-6">
                        <div>
                            <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Valor</p>
                            <p class="text-xl font-black text-blue-600 tracking-tight">
                                ${settings.storeShowPrices !== false ? this.cleanMoney(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '---'}
                            </p>
                        </div>
                        <button onclick="event.stopPropagation(); ui.addToCart('${item.id}', '${item.type}')" class="p-4 bg-gray-900 dark:bg-blue-600 text-white rounded-2xl hover:bg-blue-600 dark:hover:bg-blue-700 transition-all shadow-lg active:scale-90 relative z-10">
                            <i data-lucide="plus" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        this.renderStoreCategories(categories);
        if (window.lucide) window.lucide.createIcons();
        
        // Garantir que todos os botões e links na loja funcionem
        document.querySelectorAll('#public-store-view button, #public-store-view a').forEach(el => {
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';
        });
    },

    renderStoreCategories(categories) {
        const bar = document.getElementById('store-categories-bar');
        if (!bar) return;
        
        const isAll = this.currentStoreSection === 'all';
        const isProducts = this.currentStoreSection === 'products';
        const isServices = this.currentStoreSection === 'services';

        bar.innerHTML = `
            <button onclick="ui.setStoreSection('all')" class="px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isAll ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'}">Tudo</button>
            <button onclick="ui.setStoreSection('products')" class="px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isProducts ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'}">Produtos</button>
            <button onclick="ui.setStoreSection('services')" class="px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isServices ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'}">Serviços</button>
            ${categories.map(cat => {
                const isActive = this.currentStoreSection === cat.id;
                return `
                    <button onclick="ui.setStoreSection('${cat.id}')" class="px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'}">
                        ${cat.name}
                    </button>
                `;
            }).join('')}
        `;
    },

    setStoreSection(section) {
        console.log('Filtrando loja por:', section);
        this.currentStoreSection = section;
        this.renderPublicStore();
    },

    updateSmartTime() {
        const timeInput = document.getElementById('budget-total-time');
        const display = document.getElementById('budget-total-time-display');
        if (!timeInput || !display) return;

        const minutes = parseInt(timeInput.value) || 0;
        if (minutes <= 0) {
            display.innerText = 'Não informado';
            return;
        }

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        let text = '';
        if (hours > 0) text += `${hours}h `;
        if (mins > 0 || hours === 0) text += `${mins}min`;
        
        display.innerText = text;
    },
    nextBudgetStep() {
        console.log('Navigating to next step. Current:', this.currentBudgetStep);
        if (this.currentBudgetStep === 1) {
            const name = document.getElementById('budget-client-name')?.value;
            const doc = document.getElementById('budget-client-doc')?.value;
            const phone = document.getElementById('budget-client-phone')?.value;
            const executionDate = document.getElementById('budget-execution-date')?.value;

            if (!name || !doc || !phone || !executionDate) {
                alert('Preencha todos os campos obrigatórios (Nome, CPF/CNPJ, WhatsApp e Data de Execução) antes de continuar.');
                return;
            }
        } else if (this.currentBudgetStep === 2) {
            if (this.budgetItems.length === 0) {
                alert('Selecione pelo menos um produto ou serviço para o orçamento.');
                return;
            }
        }

        if (this.currentBudgetStep < 3) {
            this.currentBudgetStep++;
            this.showBudgetStep(this.currentBudgetStep);
        }
    },
    prevBudgetStep() {
        if (this.currentBudgetStep > 1) {
            this.currentBudgetStep--;
            this.showBudgetStep(this.currentBudgetStep);
        }
    },
    showBudgetStep(step) {
        this.currentBudgetStep = step;
        
        // Update Indicator Text
        const indicator = document.getElementById('budget-step-indicator');
        if (indicator) {
            const steps = [
                'Etapa 1 de 3: Dados do Cliente',
                'Etapa 2 de 3: Itens e Valores',
                'Etapa 3 de 3: Revisão e Finalização'
            ];
            indicator.innerText = steps[step - 1] || `Etapa ${step} de 3`;
            indicator.classList.remove('hidden'); // Garantir que o indicador não seja escondido
        }

        // Hide all steps
        document.querySelectorAll('.budget-step').forEach(el => {
            el.classList.add('hidden');
        });
        
        // Show current step
        const currentEl = document.getElementById(`budget-step-${step}`);
        if (currentEl) currentEl.classList.remove('hidden');
        
        // Update progress indicators
        document.querySelectorAll('.budget-progress-step').forEach((el, idx) => {
            const stepNum = idx + 1;
            if (stepNum <= step) {
                el.classList.add('bg-blue-600', 'text-white');
                el.classList.remove('bg-gray-100', 'text-gray-400');
            } else {
                el.classList.remove('bg-blue-600', 'text-white');
                el.classList.add('bg-gray-100', 'text-gray-400');
            }
        });

        // Update buttons
        const btnPrev = document.getElementById('budget-btn-prev');
        const btnNext = document.getElementById('budget-btn-next');
        const btnSubmit = document.getElementById('budget-btn-submit');

        if (btnPrev) {
            if (step === 1) {
                btnPrev.classList.add('opacity-0', 'pointer-events-none');
            } else {
                btnPrev.classList.remove('opacity-0', 'pointer-events-none');
            }
        }

        if (step === 3) {
            if (btnNext) btnNext.classList.add('hidden');
            if (btnSubmit) btnSubmit.classList.remove('hidden');
        } else {
            if (btnNext) btnNext.classList.remove('hidden');
            if (btnSubmit) btnSubmit.classList.add('hidden');
        }
    },

    async syncToDB() {
        const btn = document.querySelector('button[onclick="ui.syncToDB()"]');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Sincronizando...';
            btn.disabled = true;
            if (window.lucide) window.lucide.createIcons();
            
            try {
                await Storage.init();
                this.renderAll();
                this.renderTabContent(this.currentTab);
                alert('Dados sincronizados com sucesso!');
            } catch (e) {
                alert('Erro ao sincronizar dados: ' + e.message);
            } finally {
                btn.innerHTML = original;
                btn.disabled = false;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    },

    async saveCliente(e) {
        if (e) e.preventDefault();
        const form = e.target || document.getElementById('form-cliente');
        
        const name = document.getElementById('client-name').value;
        const doc = document.getElementById('client-document').value;
        const phone = document.getElementById('client-phone').value;

        if (!name || !doc || !phone) {
            alert('Por favor, preencha os campos obrigatórios: Nome, CPF/CNPJ e WhatsApp.');
            return;
        }

        const client = {
            id: form.dataset.editId || Date.now().toString(),
            name,
            email: document.getElementById('client-email').value,
            phone,
            address: document.getElementById('client-address').value,
            cpf_cnpj: doc,
            notes: document.getElementById('client-notes') ? document.getElementById('client-notes').value : '',
            status: 'Ativo'
        };

        try {
            await Storage.saveItem(Storage.KEYS.CLIENTS, client);
            this.closeModal('modal-cliente');
            form.reset();
            delete form.dataset.editId;
            this.loadClientes();
        } catch (e) {
            alert('Erro ao salvar cliente: ' + e.message);
        }
    },

    async saveProduto(e) {
        if (e) e.preventDefault();
        const form = e.target || document.getElementById('form-produto');
        
        const name = document.getElementById('product-name').value;
        const category = document.getElementById('product-category').value;
        const price = this.cleanMoney(document.getElementById('product-price').value);

        if (!name || !category || !price) {
            alert('Por favor, preencha todos os campos obrigatórios (Nome, Categoria e Preço de Venda).');
            return;
        }

        const product = {
            id: form.dataset.editId || Date.now().toString(),
            name: name,
            code: document.getElementById('product-code') ? document.getElementById('product-code').value : '',
            category: category,
            description: document.getElementById('product-description').value,
            stock: parseInt(document.getElementById('product-stock').value || 0, 10),
            minStock: document.getElementById('product-min-stock') ? parseInt(document.getElementById('product-min-stock').value || 0, 10) : 5,
            unit: document.getElementById('product-unit') ? document.getElementById('product-unit').value : 'UN',
            customUnit: document.getElementById('product-custom-unit') ? document.getElementById('product-custom-unit').value : '',
            price: price
        };

        try {
            await Storage.saveItem(Storage.KEYS.PRODUCTS, product);
            this.closeModal('modal-produto');
            form.reset();
            delete form.dataset.editId;
            this.loadProdutos();
        } catch (e) {
            alert('Erro ao salvar produto: ' + e.message);
        }
    },

    async saveServico(e) {
        if (e) e.preventDefault();
        const form = e.target || document.getElementById('form-servico');
        
        const name = document.getElementById('service-name').value;
        const price = this.cleanMoney(document.getElementById('service-price').value);
        const category = document.getElementById('service-category').value;

        if (!name || !price || !category) {
            alert('Por favor, preencha os campos obrigatórios: Nome do Serviço, Preço e Categoria.');
            return;
        }

        const service = {
            id: form.dataset.editId || Date.now().toString(),
            name: document.getElementById('service-name').value,
            price: this.cleanMoney(document.getElementById('service-price').value),
            category: document.getElementById('service-category').value,
            description: document.getElementById('service-description').value
        };

        try {
            await Storage.saveItem(Storage.KEYS.SERVICES, service);
            this.closeModal('modal-servico');
            form.reset();
            delete form.dataset.editId;
            this.loadServicos();
        } catch (e) {
            alert('Erro ao salvar serviço: ' + e.message);
        }
    },

    async saveConfig(e) {
        if (e) e.preventDefault();
        console.log('Salvando configurações...');
        
        const settings = Storage.getSettings();
        
        const fields = {
            'settings-company-name': 'companyName',
            'settings-cnpj': 'cnpj',
            'settings-address': 'address',
            'settings-phone': 'phone',
            'settings-whatsapp': 'whatsapp',
            'settings-tab-title': 'tabTitle',
            'settings-primary-color': 'primaryColor',
            'settings-store-slug': 'storeSlug'
        };

        Object.entries(fields).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) settings[key] = el.value;
        });

        const storeActive = document.getElementById('store-active');
        const showPrices = document.getElementById('store-show-prices');
        if (storeActive) settings.storeActive = storeActive.checked;
        if (showPrices) settings.storeShowPrices = showPrices.checked;

        const logoPreview = document.getElementById('settings-logo-preview');
        if (logoPreview) {
            settings.logo = logoPreview.classList.contains('hidden') ? '' : logoPreview.src;
        }

        const faviconPreview = document.getElementById('settings-favicon-preview');
        if (faviconPreview) {
            settings.favicon = faviconPreview.classList.contains('hidden') ? '' : faviconPreview.src;
        }

        try {
            // 1. Atualizar LocalStorage IMEDIATAMENTE (Síncrono por baixo dos panos)
            // e iniciar o envio para o Firebase em background
            const savePromise = Storage.saveItem(Storage.KEYS.SETTINGS, settings);
            
            // 2. Aplicar mudanças visuais IMEDIATAMENTE para o usuário sentir a resposta
            if (settings.tabTitle) document.title = settings.tabTitle;
            if (settings.favicon) this.updateFavicon(settings.favicon);
            this.applyTheme();
            
            // Renderizar para atualizar nomes de empresa e cores em outros componentes
            this.renderAll();

            // 3. Aguardar a confirmação da nuvem apenas para feedback silencioso
            savePromise.then(() => {
                this.showToast('Configurações sincronizadas com a nuvem');
            }).catch(err => {
                console.error('Erro na sincronização:', err);
                this.showToast('Erro ao sincronizar com a nuvem', 'error');
            });
            
            this.showToast('Configurações salvas localmente!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            this.showToast('Erro ao salvar configurações: ' + err.message, 'error');
        }
    },

    async saveAgenda(e) {
        if (e) e.preventDefault();
        
        const id = document.getElementById('agenda-id')?.value || Date.now().toString();
        const title = document.getElementById('agenda-title')?.value;
        const date = document.getElementById('agenda-date')?.value;
        const time = document.getElementById('agenda-time')?.value;
        const client = document.getElementById('agenda-client')?.value;
        const notes = document.getElementById('agenda-notes')?.value;

        if (!title || !date) {
            alert('Preencha os campos obrigatórios (Título e Data).');
            return;
        }

        const item = {
            id,
            date,
            time,
            client,
            title,
            notes,
            status: 'Agendado'
        };

        try {
            await Storage.saveItem(Storage.KEYS.AGENDA, item);
            alert('Agendamento salvo com sucesso!');
            this.closeModal('modal-agenda');
            this.loadAgenda();
            this.loadDashboard();
            const form = document.getElementById('form-agenda') || (e && e.target && e.target.tagName === 'FORM' ? e.target : null);
            if (form && typeof form.reset === 'function') form.reset();
            if (form) delete form.dataset.editId;
        } catch (err) {
            console.error('Erro ao salvar agendamento:', err);
            alert('Erro ao salvar agendamento.');
        }
    },

    async testDB() {
        const btn = document.getElementById('btn-test-db');
        const result = document.getElementById('db-test-result');
        if (!btn || !result) return;

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="w-4 h-4 animate-spin" data-lucide="loader-2"></i> Testando...';
        if (window.lucide) window.lucide.createIcons();

        result.classList.remove('hidden', 'text-green-600', 'text-red-600', 'text-blue-600');
        result.classList.add('text-blue-600');
        result.innerText = 'Conectando ao Firebase...';
        result.classList.remove('hidden');

        try {
            await Storage.testConnection();
            result.classList.remove('text-blue-600');
            result.classList.add('text-green-600');
            result.innerText = 'Conexão estabelecida com sucesso!';
        } catch (err) {
            result.classList.remove('text-blue-600');
            result.classList.add('text-red-600');
            result.innerText = 'Erro na conexão: ' + err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    },

    setProductTab(tab) {
        document.querySelectorAll('[onclick^="ui.setProductTab"]').forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${tab}'`)) {
                btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
                btn.classList.remove('text-gray-400');
            } else {
                btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
                btn.classList.add('text-gray-400');
            }
        });

        const containers = {
            'produtos': 'product-list-container',
            'categorias': 'product-categories-container',
            'estoque-baixo': 'product-low-stock-container'
        };

        Object.values(containers).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const active = document.getElementById(containers[tab]);
        if (active) active.classList.remove('hidden');

        if (tab === 'categorias') this.loadCategorias();
        else if (tab === 'produtos') this.loadProdutos();
    },

    setBudgetTab(status) {
        document.querySelectorAll('[onclick^="ui.setBudgetTab"]').forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${status}'`)) {
                btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
                btn.classList.remove('text-gray-400');
            } else {
                btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-blue-600', 'shadow-sm');
                btn.classList.add('text-gray-400');
            }
        });
        
        // This would filter the grid, but for now we just reload
        this.loadOrcamentos();
    },

    renderAll() {
        const settings = Storage.getSettings();
        const companyNames = settings.companyName || 'Gestão Pro';
        
        // Update document title
        if (settings.tabTitle) {
            document.title = settings.tabTitle;
        } else {
            document.title = companyNames + ' | Sistema de Gestão';
        }

        // Update company name elements
        document.querySelectorAll('.company-name').forEach(el => el.innerText = companyNames);
        document.querySelectorAll('.company-name-nav').forEach(el => el.innerText = companyNames);
        
        // IDs específicos
        const headerCompName = document.getElementById('header-company-name');
        if (headerCompName) headerCompName.innerText = companyNames;
        
        const navCompName = document.getElementById('company-name-nav');
        if (navCompName) navCompName.innerText = companyNames;
        
        // Update Logos everywhere
        const logoUrl = settings.logo;
        const logoImgs = [
            'sidebar-logo',
            'view-company-logo',
            'store-logo',
            'print-logo'
        ];

        const logoPlaceholders = [
            'sidebar-logo-icon-container',
            'store-logo-placeholder'
        ];

        if (logoUrl) {
            logoImgs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.src = logoUrl;
                    el.classList.remove('hidden');
                }
            });
            logoPlaceholders.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            const viewLogoContainer = document.getElementById('view-company-logo-container');
            if (viewLogoContainer) viewLogoContainer.classList.remove('hidden');
            const printLogoContainer = document.getElementById('print-logo-container');
            if (printLogoContainer) printLogoContainer.classList.remove('hidden');
        } else {
            logoImgs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            logoPlaceholders.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });
            const viewLogoContainer = document.getElementById('view-company-logo-container');
            if (viewLogoContainer) viewLogoContainer.classList.add('hidden');
            const printLogoContainer = document.getElementById('print-logo-container');
            if (printLogoContainer) printLogoContainer.classList.add('hidden');
        }

        // Update Favicon
        if (settings.favicon) {
            this.updateFavicon(settings.favicon);
        }

        // Se estiver em uma aba específica, recarregar seu conteúdo
        if (this.currentTab) {
            this.setTab(this.currentTab);
        } else {
            this.setTab('dashboard');
        }
    },



    loadLinkVendas() {
        const settings = Storage.getSettings();
        const url = this.getPublicStoreUrl();

        const urlEl = document.getElementById('public-store-url');
        if (urlEl) {
            urlEl.innerText = url;
        }

        const btnViewStore = document.getElementById('btn-visualizar-loja');
        if (btnViewStore) {
            btnViewStore.href = url;
            btnViewStore.onclick = (e) => {
                e.preventDefault();
                this.openPublicStore(e);
            };
        }

        const activeSwitch = document.getElementById('store-active');
        const priceSwitch = document.getElementById('store-show-prices');

        if (activeSwitch) activeSwitch.checked = settings.storeActive !== false;
        if (priceSwitch) priceSwitch.checked = settings.storeShowPrices !== false;

        const products = Storage.getProducts();
        const services = Storage.getServices();
        const countsEl = document.getElementById('store-counts-summary');
        if (countsEl) {
            countsEl.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl text-center">
                        <p class="text-lg font-black text-gray-900 dark:text-white">${products.length}</p>
                        <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Produtos</p>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl text-center">
                        <p class="text-lg font-black text-gray-900 dark:text-white">${services.length}</p>
                        <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Serviços</p>
                    </div>
                </div>
            `;
        }

        // QR Code
        this.renderStoreQRCode(url);

        this.renderStorePreview();
    },

    renderStoreQRCode(url) {
        const container = document.getElementById('store-qr-code');
        if (!container) return;

        try {
            const qr = qrcode(0, 'M');
            qr.addData(url);
            qr.make();
            container.innerHTML = qr.createImgTag(5);
        } catch (e) {
            console.error('Erro ao gerar QR Code:', e);
            container.innerHTML = '<p class="text-[10px] text-gray-400">QR Code indisponível</p>';
        }
    },

    saveStoreSettings() {
        const settings = Storage.getSettings();
        const activeSwitch = document.getElementById('store-active');
        const priceSwitch = document.getElementById('store-show-prices');

        if (activeSwitch) settings.storeActive = activeSwitch.checked;
        if (priceSwitch) settings.storeShowPrices = priceSwitch.checked;

        Storage.saveItem(Storage.KEYS.SETTINGS, settings)
            .then(() => {
                this.renderStorePreview();
            })
            .catch(err => {
                console.error('Erro ao salvar config de loja:', err);
            });
    },

    renderStorePreview() {
        const previewEl = document.getElementById('store-preview-content');
        if (!previewEl) return;

        const settings = Storage.getSettings();
        const products = Storage.getProducts();
        const services = Storage.getServices();
        const showPrices = settings.storeShowPrices !== false;
        const isActive = settings.storeActive !== false;

        if (!isActive) {
            previewEl.innerHTML = `
                <div class="p-6 text-center flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 text-gray-400">
                    <i data-lucide="store-off" class="w-12 h-12 mb-4 text-red-500"></i>
                    <p class="text-sm font-bold text-gray-800 dark:text-white mb-1 uppercase tracking-wider">Loja Temporariamente Inativa</p>
                    <p class="text-xs">Ative a chave de configuração para exibir o catálogo online.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let itemsHtml = '';

        if (products.length === 0 && services.length === 0) {
            itemsHtml = `
                <div class="p-6 text-center text-gray-400">
                    <p class="text-xs">Nenhum item cadastrado no catálogo.</p>
                </div>
            `;
        } else {
            itemsHtml = `
                <div class="p-4 space-y-4">
                    <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-1 mb-2">Produtos</h4>
                    ${products.slice(0, 3).map(p => `
                        <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div>
                                <p class="text-xs font-black text-gray-900 dark:text-white truncate max-w-[150px]">${p.name}</p>
                                <p class="text-[9px] font-bold text-gray-400 uppercase">Estoque: ${p.stock}</p>
                            </div>
                            ${showPrices ? `
                                <p class="text-xs font-black text-blue-600">R$ ${parseFloat(p.price || 0).toFixed(2)}</p>
                            ` : `
                                <p class="text-[9px] font-bold text-gray-400 uppercase">Sob Consulta</p>
                            `}
                        </div>
                    `).join('')}
                    ${products.length > 3 ? `<p class="text-[9px] text-center font-bold text-blue-600 uppercase">+ ${products.length - 3} outros produtos</p>` : ''}

                    <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-1 mt-4 mb-2">Serviços</h4>
                    ${services.slice(0, 3).map(s => `
                        <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div>
                                <p class="text-xs font-black text-gray-900 dark:text-white truncate max-w-[150px]">${s.name}</p>
                                <p class="text-[9px] font-bold text-gray-400 uppercase">${s.category || 'Geral'}</p>
                            </div>
                            ${showPrices ? `
                                <p class="text-xs font-black text-blue-600">R$ ${parseFloat(s.price || 0).toFixed(2)}</p>
                            ` : `
                                <p class="text-[9px] font-bold text-gray-400 uppercase">Sob Consulta</p>
                            `}
                        </div>
                    `).join('')}
                    ${services.length > 3 ? `<p class="text-[9px] text-center font-bold text-blue-600 uppercase">+ ${services.length - 3} outros serviços</p>` : ''}
                </div>
            `;
        }

        previewEl.innerHTML = `
            <div class="bg-white dark:bg-gray-900 min-h-full pb-8">
                <div class="bg-blue-600 p-6 text-white text-center flex flex-col items-center">
                    <div class="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-2">
                        <i data-lucide="store" class="w-6 h-6 text-white"></i>
                    </div>
                    <h3 class="text-sm font-black uppercase tracking-tight">${settings.companyName || 'Gestão Pro'}</h3>
                    <p class="text-[9px] text-blue-200 uppercase font-bold tracking-widest">Catálogo Online</p>
                </div>
                ${itemsHtml}
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
    },

    loadRelatorios() {
        const movements = Storage.getMovements();
        const budgets = Storage.getBudgets();
        const clients = Storage.getClients();
        const products = Storage.getProducts();

        const calculateProfit = (mMonth, mYear) => {
            const rev = movements
                .filter(m => {
                    if (!m.date || m.type !== 'Receita') return false;
                    const parts = m.date.split('/');
                    if (parts.length !== 3) return false;
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    return month === mMonth && year === mYear;
                })
                .reduce((acc, curr) => acc + parseFloat(curr.value || 0), 0);
            
            const exp = movements
                .filter(m => {
                    if (!m.date || m.type !== 'Despesa') return false;
                    const parts = m.date.split('/');
                    if (parts.length !== 3) return false;
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    return month === mMonth && year === mYear;
                })
                .reduce((acc, curr) => acc + parseFloat(curr.value || 0), 0);
            
            return rev - exp;
        };

        const now = new Date();
        const estimatedProfit = calculateProfit(now.getMonth(), now.getFullYear());
        
        const lastMonthDate = new Date(now);
        lastMonthDate.setMonth(now.getMonth() - 1);
        const prevProfit = calculateProfit(lastMonthDate.getMonth(), lastMonthDate.getFullYear());

        const totalClients = clients.length;
        const totalProducts = products.length;
        const lowStockCount = products.filter(p => parseInt(p.stock || 0) < 5).length;

        const totalBudgets = budgets.length;
        const approvedBudgets = budgets.filter(b => b.status === 'Aprovado' || b.status === 'Pago').length;
        const approvalRate = totalBudgets > 0 ? ((approvedBudgets / totalBudgets) * 100).toFixed(0) : 0;

        const profitEl = document.getElementById('report-total-profit');
        const clientsEl = document.getElementById('report-total-clients');
        const productsEl = document.getElementById('report-total-products');
        const lowStockEl = document.getElementById('report-low-stock-count');
        const approvalRateEl = document.getElementById('report-approval-rate');

        if (profitEl) profitEl.innerText = `R$ ${estimatedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (clientsEl) clientsEl.innerText = totalClients;
        if (productsEl) productsEl.innerText = totalProducts;
        if (lowStockEl) lowStockEl.innerText = lowStockCount;
        if (approvalRateEl) approvalRateEl.innerText = `${approvalRate}%`;

        // Profit Trend
        const profitTrendEl = document.getElementById('report-profit-trend');
        const profitTrendValueEl = document.getElementById('report-profit-trend-value');
        if (profitTrendEl && profitTrendValueEl) {
            if (Math.abs(estimatedProfit) > 0 && Math.abs(prevProfit) > 0) {
                const diff = ((estimatedProfit - prevProfit) / Math.abs(prevProfit)) * 100;
                profitTrendValueEl.innerText = `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
                profitTrendEl.className = `mt-4 flex items-center gap-2 text-[10px] font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`;
            } else {
                profitTrendEl.classList.add('hidden');
            }
        }

        if (window.revenueChart) {
            window.revenueChart.destroy();
        }
        if (window.budgetsChart) {
            window.budgetsChart.destroy();
        }

        const revenueCtx = document.getElementById('chart-revenue');
        if (revenueCtx) {
            const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const monthlyData = Array(12).fill(0);
            let hasRevenue = false;
            
            movements.forEach(m => {
                if (m.type === 'Receita' && m.date) {
                    const parts = m.date.split('/');
                    if (parts.length >= 2) {
                        const monthIndex = parseInt(parts[1], 10) - 1;
                        if (monthIndex >= 0 && monthIndex < 12) {
                            const val = parseFloat(m.value || 0);
                            monthlyData[monthIndex] += val;
                            if (val > 0) hasRevenue = true;
                        }
                    }
                }
            });

            const canvas = revenueCtx;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                if (!hasRevenue) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = 'bold 12px Inter';
                    ctx.textAlign = 'center';
                    ctx.fillText('Sem dados de receita para exibir', canvas.width / 2, canvas.height / 2);
                } else {
                    const currentMonthIndex = new Date().getMonth();
                    const labels = [];
                    const data = [];
                    for (let i = 5; i >= 0; i--) {
                        let mIdx = currentMonthIndex - i;
                        if (mIdx < 0) mIdx += 12;
                        labels.push(monthsNames[mIdx]);
                        data.push(monthlyData[mIdx]);
                    }

                    window.revenueChart = new Chart(revenueCtx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Receita (R$)',
                                data: data,
                                borderColor: '#2563EB',
                                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                borderWidth: 3,
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    grid: { color: 'rgba(156, 163, 175, 0.1)' }
                                },
                                x: {
                                    grid: { display: false }
                                }
                            }
                        }
                    });
                }
            }
        }

        const budgetsCtx = document.getElementById('chart-budgets');
        if (budgetsCtx) {
            const pending = budgets.filter(b => b.status === 'Pendente').length;
            const approved = budgets.filter(b => b.status === 'Aprovado' || b.status === 'Pago').length;
            const rejected = budgets.filter(b => b.status === 'Cancelado' || b.status === 'Rejeitado').length;

            const canvas = budgetsCtx;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                if (pending === 0 && approved === 0 && rejected === 0) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = 'bold 12px Inter';
                    ctx.textAlign = 'center';
                    ctx.fillText('Nenhum orçamento cadastrado', canvas.width / 2, canvas.height / 2);
                } else {
                    window.budgetsChart = new Chart(budgetsCtx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Pendente', 'Aprovado / Pago', 'Cancelado / Rejeitado'],
                            datasets: [{
                                data: [pending, approved, rejected],
                                backgroundColor: ['#EAB308', '#22C55E', '#EF4444'],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        padding: 20,
                                        font: { size: 10, weight: 'bold' }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
        
        this.renderTopClients();
        this.renderTopItems();
    },

    renderTopClients() {
        const container = document.getElementById('report-top-clients-list');
        if (!container) return;

        const budgets = Storage.getBudgets();
        const clients = Storage.getClients();
        
        // Calcular faturamento por cliente
        const clientRevenue = {};
        budgets.filter(b => b.status === 'Aprovado' || b.status === 'Pago').forEach(b => {
            if (b.clientId) {
                clientRevenue[b.clientId] = (clientRevenue[b.clientId] || 0) + parseFloat(b.total || 0);
            }
        });

        const sortedClients = Object.entries(clientRevenue)
            .map(([id, revenue]) => {
                const client = clients.find(c => c.id === id);
                return {
                    name: client ? client.name : 'Desconhecido',
                    revenue
                };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        if (sortedClients.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic">Sem dados de clientes para exibir</p>';
            return;
        }

        container.innerHTML = sortedClients.map(c => `
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-gray-700 dark:text-gray-300">${c.name}</span>
                <span class="text-xs font-black text-blue-600">R$ ${c.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
        `).join('');
    },

    renderTopItems() {
        const container = document.getElementById('report-top-items-list');
        if (!container) return;

        const budgets = Storage.getBudgets();
        
        // Calcular itens mais vendidos
        const itemCounts = {};
        budgets.filter(b => b.status === 'Aprovado' || b.status === 'Pago').forEach(b => {
            if (b.items && Array.isArray(b.items)) {
                b.items.forEach(item => {
                    const key = item.description || item.name;
                    if (key) {
                        itemCounts[key] = (itemCounts[key] || 0) + (item.quantity || 1);
                    }
                });
            }
        });

        const sortedItems = Object.entries(itemCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (sortedItems.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic">Sem dados de itens para exibir</p>';
            return;
        }

        container.innerHTML = sortedItems.map(i => `
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-gray-700 dark:text-gray-300">${i.name}</span>
                <span class="text-xs font-black text-purple-600">${i.count} vendas</span>
            </div>
        `).join('');
    },
};

window.ui = ui;

// Garantir que o objeto UI esteja disponível o mais cedo possível
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ui.init());
} else {
    ui.init();
}

export default ui;
