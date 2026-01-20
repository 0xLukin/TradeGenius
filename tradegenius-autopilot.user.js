// ==UserScript==
// @name         Auto Swap Bot + Random Auto Refresh
// @namespace    https://hunter-association.io
// @version      2.0.0
// @description  Automated swap execution with random auto-refresh (20-40min)
// @author       伍壹51
// @homepage     https://x.com/0x515151
// @match        https://www.tradegenius.com/trade
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ========= 小保護：只在頂層頁面跑（避免 iframe 重複啟動）=========
  if (window.top !== window.self) return;

  // ========= Auto Refresh 配置 =========
  const REFRESH_CONFIG = {
    MIN_MINUTES: 20,
    MAX_MINUTES: 40,
    KEY_ENABLED: 'tg_rand_refresh_enabled',
    KEY_NEXT_AT: 'tg_rand_refresh_next_at',
    KEY_SWAP_RUNNING: 'tg_swap_running', // 保存swap运行状态
  };

  const MIN_MS = REFRESH_CONFIG.MIN_MINUTES * 60 * 1000;
  const MAX_MS = REFRESH_CONFIG.MAX_MINUTES * 60 * 1000;

  // ========= Auto Swap 配置 =========
  const SWAP_CONFIG = {
    waitAfterMax: 1000,
    maxRetryConfirm: 20,
    waitAfterConfirm: 3000,
    waitAfterFixSwitch: 2000,
    waitRandomMin: 12000,
    waitRandomMax: 25000,
    waitAfterClose: 1500,
    waitAfterChoose: 1000,
    waitAfterTokenSelect: 1500,
    waitAfterTabClick: 800,
    waitForHover: 500,
    waitBeforeStart: 1200,
  };

  // ========= 共用工具函數 =========
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randDelay = () => randInt(MIN_MS, MAX_MS);
  const getRandomTime = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString();
  const fmtLeft = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };
  
  // 检测操作系统工具函数
  const isMacOS = () => navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // ========= Swap Bot 變數 =========
  let isSwapRunning = false;
  let selectedFromToken = null;
  let selectedToToken = null;
  let selectedPair = null;
  let loopPromise = null;
  let selectedChains = ['BNB']; // 默认选择BNB链
  let isPanelCollapsed = false; // 面板折叠状态

  // ========= Auto Refresh 變數 =========
  let refreshEnabled = localStorage.getItem(REFRESH_CONFIG.KEY_ENABLED);
  refreshEnabled = refreshEnabled === null ? true : refreshEnabled === '1';
  let refreshTimerId = null;
  let refreshTickerId = null;

  // ========= Chain Selection 配置 =========
  const CHAIN_CONFIG = {
    KEY_SELECTED_CHAIN: 'tg_selected_chain',
    SUPPORTED_CHAINS: ['BNB', 'OP', 'SOL'],
    CHAIN_ALIASES: {
      'BNB': ['BNB', 'Binance', 'BNB Chain'],
      'OP': ['OP', 'Optimism', 'Optimism Network'],
      'SOL': ['SOL', 'Solana', 'Solana Network']
    }
  };

  // ========= Trading Pair 配置 =========
  const PAIR_CONFIG = {
    KEY_SELECTED_PAIR: 'tg_selected_pair',
    SUPPORTED_PAIRS: [
      { name: 'USDT/USDC', from: 'USDT', to: 'USDC', chain: 'any' },
      { name: 'KOGE/USDT', from: 'KOGE', to: 'USDT', chain: 'BNB' }
    ]
  };

  // 加载用户选择的链配置
  function loadChainConfig() {
    const saved = localStorage.getItem(CHAIN_CONFIG.KEY_SELECTED_CHAIN);
    if (saved && CHAIN_CONFIG.SUPPORTED_CHAINS.includes(saved)) {
      selectedChains = [saved]; // 单选，只保存一个链
    } else {
      selectedChains = ['BNB']; // 默认选择BNB链
    }
  }

  // 保存链配置
  function saveChainConfig() {
    localStorage.setItem(CHAIN_CONFIG.KEY_SELECTED_CHAIN, selectedChains[0] || 'BNB');
  }

  // 加载交易对配置
  function loadPairConfig() {
    const saved = localStorage.getItem(PAIR_CONFIG.KEY_SELECTED_PAIR);
    if (saved) {
      const pair = PAIR_CONFIG.SUPPORTED_PAIRS.find(p => p.name === saved);
      if (pair) {
        selectedPair = pair;
        selectedFromToken = pair.from;
        selectedToToken = pair.to;
        return;
      }
    }
    // 默认选择 USDT/USDC
    selectedPair = PAIR_CONFIG.SUPPORTED_PAIRS[0];
    selectedFromToken = selectedPair.from;
    selectedToToken = selectedPair.to;
  }

  // 保存交易对配置
  function savePairConfig() {
    localStorage.setItem(PAIR_CONFIG.KEY_SELECTED_PAIR, selectedPair.name);
  }

  // ========= 合併 UI 面板 =========
  const UI = {
    root: null,
    // Swap Bot UI
    swapStatusDot: null,
    swapStatusText: null,
    swapBtnToggle: null,
    swapLogEl: null,
    // Trading Pair UI
    pairContainer: null,
    // Chain Selection UI
    chainCheckboxContainer: null,
    // Refresh UI
    refreshDot: null,
    refreshStatus: null,
    refreshNextEl: null,
    refreshLeftEl: null,
    refreshBtnToggle: null,
    refreshBtnNow: null,
    // Panel Collapse UI
    collapseBtn: null,
    mainContent: null,

    setSwapRunning(running) {
      if (!this.root) return;
      
      // 更新状态点
      if (this.swapStatusDot) {
        const color = running ? '#16a34a' : '#dc2626';
        this.swapStatusDot.style.background = color;
        this.swapStatusDot.style.boxShadow = `0 0 10px ${color}80`;
      }
      
      // 更新状态文本
      if (this.swapStatusText) {
        this.swapStatusText.textContent = running ? 'RUNNING' : 'STOPPED';
        this.swapStatusText.style.color = running ? '#22c55e' : '#ef4444';
      }
      
      // 更新按钮
      if (this.swapBtnToggle) {
        const shortcut = isMacOS() ? 'F1' : 'Ctrl+Alt+S';
        this.swapBtnToggle.textContent = running ? `Stop (${shortcut})` : `Start (${shortcut})`;
        
        if (running) {
          this.swapBtnToggle.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
          this.swapBtnToggle.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
        } else {
          this.swapBtnToggle.style.background = 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';
          this.swapBtnToggle.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
        }
      }
    },

    logSwap(msg) {
      if (!this.swapLogEl) return;
      const t = new Date().toLocaleTimeString();
      this.swapLogEl.textContent = `[${t}] ${msg}\n` + this.swapLogEl.textContent.slice(0, 1200);
    },

    renderRefresh(nextAt) {
      const isOn = refreshEnabled;
      
      // 更新状态点
      if (this.refreshDot) {
        const color = isOn ? '#16a34a' : '#dc2626';
        this.refreshDot.style.background = color;
        this.refreshDot.style.boxShadow = `0 0 10px ${color}80`;
      }
      
      // 更新状态文本
      if (this.refreshStatus) {
        this.refreshStatus.textContent = isOn ? 'RUNNING' : 'PAUSED';
        this.refreshStatus.style.color = isOn ? '#22c55e' : '#ef4444';
      }
      
      // 更新按钮
      if (this.refreshBtnToggle) {
        const refreshShortcut = isMacOS() ? 'F2' : 'Ctrl+Alt+R';
        this.refreshBtnToggle.textContent = isOn ? `Pause (${refreshShortcut})` : `Resume (${refreshShortcut})`;
        
        if (isOn) {
          this.refreshBtnToggle.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
          this.refreshBtnToggle.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
        } else {
          this.refreshBtnToggle.style.background = 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';
          this.refreshBtnToggle.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
        }
      }

      const at = nextAt ?? Number(localStorage.getItem(REFRESH_CONFIG.KEY_NEXT_AT) || 0);
      
      // 更新状态卡片
      if (this.refreshNextEl) {
        const nextElement = this.refreshNextEl.querySelector('div:last-child');
        if (nextElement) {
          nextElement.textContent = at ? fmtTime(at) : 'Next: -';
        }
      }

      const leftMs = at ? (at - Date.now()) : 0;
      if (this.refreshLeftEl) {
        const leftElement = this.refreshLeftEl.querySelector('div:last-child');
        if (leftElement) {
          leftElement.textContent = at ? fmtLeft(leftMs) : 'Left: -';
        }
      }
    },

    renderPairSelection() {
      if (!this.pairContainer) return;
      
      this.pairContainer.innerHTML = '';

      PAIR_CONFIG.SUPPORTED_PAIRS.forEach(pair => {
        const label = document.createElement('label');
        label.style.cssText = `
          display: inline-flex; align-items: center; gap: 6px; 
          cursor: pointer; padding: 6px 12px; border-radius: 6px;
          background: ${selectedPair?.name === pair.name ? 'rgba(251, 146, 60, 0.2)' : 'rgba(0, 0, 0, 0.3)'};
          border: 1px solid ${selectedPair?.name === pair.name ? 'rgba(251, 146, 60, 0.4)' : 'rgba(255, 255, 255, 0.1)'};
          transition: all 0.2s ease; font-size: 11px; font-weight: 500;
          color: ${selectedPair?.name === pair.name ? '#f1f5f9' : '#94a3b8'};
        `;
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'pair-selection'; // 单选必须有相同的name
        radio.checked = selectedPair?.name === pair.name;
        radio.style.cssText = `margin:0; cursor:pointer; opacity: 0; position: absolute;`;
        
        const span = document.createElement('span');
        span.style.cssText = `
          display: flex; align-items: center; gap: 4px;
        `;
        
        // 添加交易对图标
        const pairIcon = document.createElement('span');
      const pairColors = {
      'USDT/USDC': '#10b981',
      'KOGE/USDT': '#f59e0b'
    };
        pairIcon.style.cssText = `
          width: 8px; height: 8px; border-radius: 50%; 
          background: ${pairColors[pair.name] || '#94a3b8'};
          box-shadow: 0 0 6px ${pairColors[pair.name] || '#94a3b8'}40;
        `;
        
        const pairText = document.createElement('span');
        pairText.textContent = pair.name;
        
        span.appendChild(pairIcon);
        span.appendChild(pairText);
        
        label.appendChild(radio);
        label.appendChild(span);
        
        // 悬停效果
        label.addEventListener('mouseenter', () => {
          if (selectedPair?.name !== pair.name) {
            label.style.background = 'rgba(0, 0, 0, 0.4)';
            label.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }
        });
        label.addEventListener('mouseleave', () => {
          if (selectedPair?.name !== pair.name) {
            label.style.background = 'rgba(0, 0, 0, 0.3)';
            label.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }
        });
        
        radio.addEventListener('change', () => {
          if (radio.checked) {
            selectedPair = pair;
            selectedFromToken = pair.from;
            selectedToToken = pair.to;
            savePairConfig();
            UI.logSwap(`交易对更新: ${pair.name}`);
            
            // 如果选择了KOGE/USDT，强制选择BNB链
            if (pair.name === 'KOGE/USDT' && selectedChains[0] !== 'BNB') {
              selectedChains = ['BNB'];
              saveChainConfig();
              UI.renderChainSelection();
              UI.logSwap(`KOGE/USDT 自动选择 BNB 链`);
            }
            
            // 重新渲染所有交易对选项以更新选中状态
            this.renderPairSelection();
          }
        });
        
        this.pairContainer.appendChild(label);
      });
    },

    renderChainSelection() {
      if (!this.chainCheckboxContainer) return;
      
      this.chainCheckboxContainer.innerHTML = '';

      CHAIN_CONFIG.SUPPORTED_CHAINS.forEach(chain => {
        const label = document.createElement('label');
        label.style.cssText = `
          display: inline-flex; align-items: center; gap: 6px; 
          cursor: pointer; padding: 6px 12px; border-radius: 6px;
          background: ${selectedChains.includes(chain) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 0, 0.3)'};
          border: 1px solid ${selectedChains.includes(chain) ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'};
          transition: all 0.2s ease; font-size: 11px; font-weight: 500;
          color: ${selectedChains.includes(chain) ? '#f1f5f9' : '#94a3b8'};
        `;
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'chain-selection'; // 单选必须有相同的name
        radio.checked = selectedChains.includes(chain);
        radio.style.cssText = `margin:0; cursor:pointer; opacity: 0; position: absolute;`;
        
        const span = document.createElement('span');
        span.style.cssText = `
          display: flex; align-items: center; gap: 4px;
        `;
        
        // 添加链图标
        const chainIcon = document.createElement('span');
        const iconColors = {
          'BNB': '#f59e0b',
          'OP': '#ef4444', 
          'SOL': '#8b5cf6'
        };
        chainIcon.style.cssText = `
          width: 8px; height: 8px; border-radius: 50%; 
          background: ${iconColors[chain] || '#94a3b8'};
          box-shadow: 0 0 6px ${iconColors[chain] || '#94a3b8'}40;
        `;
        
        const chainText = document.createElement('span');
        chainText.textContent = chain;
        
        span.appendChild(chainIcon);
        span.appendChild(chainText);
        
        label.appendChild(radio);
        label.appendChild(span);
        
        // 悬停效果
        label.addEventListener('mouseenter', () => {
          if (!selectedChains.includes(chain)) {
            label.style.background = 'rgba(0, 0, 0, 0.4)';
            label.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }
        });
        label.addEventListener('mouseleave', () => {
          if (!selectedChains.includes(chain)) {
            label.style.background = 'rgba(0, 0, 0, 0.3)';
            label.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }
        });
        
        radio.addEventListener('change', () => {
          if (radio.checked) {
            selectedChains = [chain]; // 单选，只保存一个链
            saveChainConfig();
            UI.logSwap(`链配置更新: ${chain}`);
            // 重新渲染所有链选项以更新选中状态
            this.renderChainSelection();
          }
        });
        
        this.chainCheckboxContainer.appendChild(label);
      });
    },

    togglePanel() {
      console.log('togglePanel called, UI elements:', {
        root: !!this.root,
        mainContent: !!this.mainContent,
        collapseBtn: !!this.collapseBtn,
        currentCollapsed: isPanelCollapsed
      });
      
      if (!this.root || !this.mainContent) {
        console.error('Missing UI elements for panel toggle');
        return;
      }
      
      isPanelCollapsed = !isPanelCollapsed;
      console.log('New collapsed state:', isPanelCollapsed);
      
      try {
      if (isPanelCollapsed) {
        // 折叠状态：只显示最小信息
        this.mainContent.style.display = 'none';
        this.root.style.width = '200px';
        this.root.style.height = 'auto';
        if (this.collapseBtn) {
          this.collapseBtn.textContent = '◀';
          this.collapseBtn.style.background = 'rgba(16, 185, 129, 0.2)';
          this.collapseBtn.style.color = '#10b981';
        }
        
        // 显示简要状态
        const miniStatus = document.createElement('div');
        miniStatus.id = 'mini-status';
        miniStatus.style.cssText = `
          padding: 12px 16px; text-align:center; font-size:10px; line-height:1.4;
          background: rgba(0,0,0,0.2);
        `;
        
        const swapStatus = this.swapStatusText?.textContent || 'STOPPED';
        const swapColor = swapStatus === 'RUNNING' ? '#22c55e' : '#ef4444';
        const refreshStatus = this.refreshStatus?.textContent || 'PAUSED';
        const refreshColor = refreshStatus === 'RUNNING' ? '#22c55e' : '#ef4444';
        
        miniStatus.innerHTML = `
          <div style="font-weight:600; margin-bottom:8px; color: #f1f5f9; font-size:11px;">
            TradeGenius Bot
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom:8px;">
            <div style="background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 6px;">
              <div style="opacity:0.6; margin-bottom:2px;">交易</div>
              <div style="font-weight:600; color: ${swapColor};">${swapStatus}</div>
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 6px;">
              <div style="opacity:0.6; margin-bottom:2px;">刷新</div>
              <div style="font-weight:600; color: ${refreshColor};">${refreshStatus}</div>
            </div>
          </div>
          <div style="opacity:0.5; font-size:9px; color: #94a3b8;">
            按 T/F3 展开面板
          </div>
        `;
        
        // 移除旧的迷你状态（如果存在）
        const oldMini = document.getElementById('mini-status');
        if (oldMini) oldMini.remove();
        
        this.root.appendChild(miniStatus);
        console.log('Panel collapsed successfully');
      } else {
        // 展开状态：显示完整内容
        this.mainContent.style.display = 'block';
        this.root.style.width = '320px';
        if (this.collapseBtn) {
          this.collapseBtn.textContent = '▶';
          this.collapseBtn.style.background = 'rgba(255, 255, 255, 0.1)';
          this.collapseBtn.style.color = 'rgba(255, 255, 255, 0.9)';
        }
        
        // 移除迷你状态
        const miniStatus = document.getElementById('mini-status');
        if (miniStatus) miniStatus.remove();
        console.log('Panel expanded successfully');
      }
      } catch (error) {
        console.error('Error during panel toggle:', error);
      }
    }
  };

  function mountUI() {
    if (UI.root) return;

    const root = document.createElement('div');
    root.style.cssText = `
      position: fixed; right: 20px; bottom: 20px; z-index: 999999;
      width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      border-radius: 16px; overflow: hidden;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
      color: #f1f5f9; backdrop-filter: blur(20px);
      box-shadow: 
        0 25px 50px -12px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // ========= 标题栏（包含折叠按钮） =========
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px; display:flex; align-items:center; gap:12px;
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性光效
    const headerGlow = document.createElement('div');
    headerGlow.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6);
      background-size: 200% 100%;
      animation: shimmer 3s ease-in-out infinite;
    `;
    header.appendChild(headerGlow);

    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shimmer {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes slideIn {
        from { transform: translateY(10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600; font-size: 14px; flex:1; color: #f1f5f9;
      letter-spacing: -0.025em; line-height: 1.2;
    `;
    title.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);"></div>
        TradeGenius AutoPilot
      </div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 2px; font-weight: 400;">
        Advanced Trading Automation
      </div>
    `;

    const collapseBtn = document.createElement('button');
    collapseBtn.textContent = '▶';
    collapseBtn.style.cssText = `
      border: none; cursor: pointer; color: rgba(255, 255, 255, 0.9); 
      padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px); font-weight: 500; font-size: 12px;
      width: 32px; height: 32px; display: flex; align-items: center;
      justify-content: center; transition: all 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    collapseBtn.addEventListener('mouseenter', () => {
      collapseBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      collapseBtn.style.transform = 'scale(1.05)';
    });
    collapseBtn.addEventListener('mouseleave', () => {
      collapseBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      collapseBtn.style.transform = 'scale(1)';
    });

    header.appendChild(title);
    header.appendChild(collapseBtn);

    // ========= 主要内容区域 =========
    const mainContent = document.createElement('div');
    mainContent.style.cssText = `display: block; animation: slideIn 0.3s ease-out;`;

    // ========= Swap Bot Section =========
    const swapSection = document.createElement('div');
    swapSection.style.cssText = `
      border-bottom: 1px solid rgba(255,255,255,0.08);
    `;

    const swapHeader = document.createElement('div');
    swapHeader.style.cssText = `
      padding: 16px 20px; display:flex; align-items:center; gap:12px;
      background: rgba(59, 130, 246, 0.05);
      transition: background 0.2s ease;
    `;

    const swapDot = document.createElement('span');
    swapDot.style.cssText = `
      width: 12px; height: 12px; border-radius: 50%; background: #dc2626; 
      display: inline-block; box-shadow: 0 0 10px rgba(220, 38, 38, 0.5);
      transition: all 0.3s ease;
    `;

    const swapTitleWrap = document.createElement('div');
    swapTitleWrap.style.cssText = `display:flex; flex-direction:column; line-height:1.3; flex:1;`;

    const swapTitle = document.createElement('div');
    swapTitle.textContent = 'AutoSwap Bot';
    swapTitle.style.cssText = `
      font-weight: 600; font-size: 13px; color: #f1f5f9;
      display: flex; align-items: center; gap: 6px;
    `;

    const swapStatus = document.createElement('div');
    swapStatus.textContent = 'STOPPED';
    swapStatus.style.cssText = `
      font-size: 11px; opacity: 0.8; font-weight: 500;
      color: #94a3b8; letter-spacing: 0.025em;
    `;

    // 检测操作系统显示正确的快捷键
    const swapShortcut = isMacOS() ? 'Start (F1)' : 'Start (Ctrl+Alt+S)';
    
    const swapBtn = document.createElement('button');
    swapBtn.textContent = swapShortcut;
    swapBtn.style.cssText = `
      margin-left: auto; border: none; cursor: pointer; color: white;
      background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
      padding: 10px 16px; border-radius: 10px; font-weight: 600; 
      font-size: 12px; letter-spacing: 0.025em; transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
      border: 1px solid rgba(34, 197, 94, 0.2);
    `;
    swapBtn.addEventListener('mouseenter', () => {
      swapBtn.style.transform = 'translateY(-2px)';
      swapBtn.style.boxShadow = '0 8px 20px rgba(34, 197, 94, 0.4)';
    });
    swapBtn.addEventListener('mouseleave', () => {
      swapBtn.style.transform = 'translateY(0)';
      swapBtn.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
    });

    swapTitleWrap.appendChild(swapTitle);
    swapTitleWrap.appendChild(swapStatus);
    swapHeader.appendChild(swapDot);
    swapHeader.appendChild(swapTitleWrap);
    swapHeader.appendChild(swapBtn);

    const swapBody = document.createElement('div');
    swapBody.style.cssText = `
      padding: 0; border-bottom: 1px solid rgba(255,255,255,0.08);
    `;

    // ========= Trading Pair Selection Section =========
    const pairSection = document.createElement('div');
    pairSection.style.cssText = `
      margin: 0; padding: 16px 20px; 
      background: linear-gradient(90deg, rgba(251, 146, 60, 0.03) 0%, rgba(250, 204, 21, 0.03) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    `;

    const pairTitle = document.createElement('div');
    pairTitle.style.cssText = `
      font-size: 12px; font-weight: 600; color: #e2e8f0; margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    `;
    pairTitle.innerHTML = `
      <span style="width: 4px; height: 4px; background: #f59e0b; border-radius: 50%;"></span>
      交易对选择
    `;

    const pairContainer = document.createElement('div');
    pairContainer.style.cssText = `display:flex; gap: 8px; flex-wrap: wrap;`;

    pairSection.appendChild(pairTitle);
    pairSection.appendChild(pairContainer);

    // ========= Chain Selection Section =========
    const chainSection = document.createElement('div');
    chainSection.style.cssText = `
      margin: 0; padding: 16px 20px; 
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.03) 0%, rgba(147, 51, 234, 0.03) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    `;

    const chainTitle = document.createElement('div');
    chainTitle.style.cssText = `
      font-size: 12px; font-weight: 600; color: #e2e8f0; margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    `;
    chainTitle.innerHTML = `
      <span style="width: 4px; height: 4px; background: #3b82f6; border-radius: 50%;"></span>
      区块链选择
    `;

    const chainCheckboxContainer = document.createElement('div');
    chainCheckboxContainer.style.cssText = `display:flex; gap: 8px; flex-wrap: wrap;`;

    chainSection.appendChild(chainTitle);
    chainSection.appendChild(chainCheckboxContainer);

    // ========= Author Info =========
    const authorInfo = document.createElement('div');
    authorInfo.style.cssText = `
      margin: 0; padding: 12px 20px; font-size: 11px; line-height: 1.4;
      background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05);
    `;
    authorInfo.innerHTML = `
      <div style="opacity: 0.9; color: #cbd5e1;">
        <div style="font-weight: 600; margin-bottom: 4px; color: #f1f5f9;">
          <span style="opacity: 0.6;">维护者：</span>0xluki
        </div>
        <div style="margin-bottom: 2px;">
          <span style="opacity: 0.6;">X:</span> 
          <a href="https://x.com/0xLuki" target="_blank" 
             style="color: #60a5fa; text-decoration: none; transition: color 0.2s;">
             @0xLuki
          </a>
        </div>
        <div>
          <span style="opacity: 0.6;">GitHub:</span> 
          <a href="https://github.com/0xLukin" target="_blank" 
             style="color: #60a5fa; text-decoration: none; transition: color 0.2s;">
             @0xLukin
          </a>
        </div>
        <div>
          <span style="opacity: 0.6;">TradeGenius:</span> 
          <a href="https://www.tradegenius.com/ref/NA4QVP" target="_blank" 
             style="color: #60a5fa; text-decoration: none; transition: color 0.2s;">
             推荐链接
          </a>
        </div>
      </div>
    `;

    // ========= Tips Section =========
    const tipsSection = document.createElement('div');
    tipsSection.style.cssText = `
      margin: 0; padding: 12px 20px;
      background: linear-gradient(90deg, rgba(251, 146, 60, 0.1) 0%, rgba(250, 204, 21, 0.1) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    `;

    const tipIcon = document.createElement('div');
    tipIcon.style.cssText = `
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; background: #f59e0b; color: white;
      border-radius: 50%; font-size: 10px; font-weight: bold; margin-right: 8px;
      vertical-align: middle;
    `;
    tipIcon.textContent = '!';

    const swapTip = document.createElement('div');
    swapTip.style.cssText = `
      font-size: 11px; opacity: 0.85; line-height: 1.4;
      color: #fef3c7; display: inline-block;
    `;
    swapTip.textContent = '确保页面可正常交易（MAX/Confirm按钮可用），建议使用英文界面。';

    const tipContainer = document.createElement('div');
    tipContainer.style.cssText = 'display: flex; align-items: flex-start;';
    tipContainer.appendChild(tipIcon);
    tipContainer.appendChild(swapTip);

    tipsSection.appendChild(tipContainer);

    // ========= Log Section =========
    const logSection = document.createElement('div');
    logSection.style.cssText = `
      margin: 0; padding: 0;
    `;

    const swapLog = document.createElement('pre');
    swapLog.style.cssText = `
      margin: 0; padding: 16px 20px; 
      background: rgba(0,0,0,0.4);
      font-size: 11px; line-height: 1.4;
      white-space: pre-wrap; word-break: break-word;
      max-height: 140px; overflow-y: auto;
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      color: #94a3b8;
      border-top: 1px solid rgba(255,255,255,0.05);
    `;
    swapLog.textContent = 'Ready.\n';

    // 自定义滚动条样式
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      .log-scroll::-webkit-scrollbar {
        width: 6px;
      }
      .log-scroll::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.2);
      }
      .log-scroll::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.3);
        border-radius: 3px;
      }
      .log-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.5);
      }
    `;
    document.head.appendChild(scrollbarStyle);
    swapLog.className = 'log-scroll';

    logSection.appendChild(swapLog);

    swapBody.appendChild(pairSection);
    swapBody.appendChild(chainSection);
    swapBody.appendChild(authorInfo);
    swapBody.appendChild(tipsSection);
    swapBody.appendChild(logSection);

    // ========= Refresh Section =========
    const refreshSection = document.createElement('div');
    refreshSection.style.cssText = `border-bottom: none;`;

    const refreshHeader = document.createElement('div');
    refreshHeader.style.cssText = `
      padding: 16px 20px; display:flex; gap:12px; align-items:center;
      background: rgba(34, 197, 94, 0.05);
    `;

    const refreshDot = document.createElement('span');
    refreshDot.style.cssText = `
      width: 12px; height: 12px; border-radius: 50%; background: #16a34a; 
      display: inline-block; box-shadow: 0 0 10px rgba(22, 163, 74, 0.5);
      transition: all 0.3s ease;
    `;

    const refreshTitleWrap = document.createElement('div');
    refreshTitleWrap.style.cssText = `display:flex; flex-direction:column; line-height:1.3; flex:1;`;

    const refreshTitle = document.createElement('div');
    refreshTitle.textContent = 'Auto Refresh';
    refreshTitle.style.cssText = `
      font-weight: 600; font-size: 13px; color: #f1f5f9;
    `;

    const refreshStatus = document.createElement('div');
    refreshStatus.textContent = 'RUNNING';
    refreshStatus.style.cssText = `
      font-size: 11px; opacity: 0.8; font-weight: 500;
      color: #94a3b8; letter-spacing: 0.025em;
    `;

    refreshTitleWrap.appendChild(refreshTitle);
    refreshTitleWrap.appendChild(refreshStatus);

    refreshHeader.appendChild(refreshDot);
    refreshHeader.appendChild(refreshTitleWrap);

    const refreshBody = document.createElement('div');
    refreshBody.style.cssText = `
      padding: 0; background: rgba(0,0,0,0.2);
    `;

    // ========= Status Cards =========
    const statusGrid = document.createElement('div');
    statusGrid.style.cssText = `
      display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
      background: rgba(255,255,255,0.08);
      margin: 16px 20px 12px; border-radius: 8px; overflow: hidden;
    `;

    const refreshNext = document.createElement('div');
    refreshNext.style.cssText = `
      padding: 10px 12px; background: rgba(0,0,0,0.3); font-size: 11px;
      color: #cbd5e1; display: flex; flex-direction: column; align-items: center;
    `;
    refreshNext.innerHTML = `
      <div style="opacity: 0.6; margin-bottom: 2px;">下次刷新</div>
      <div style="font-weight: 600; color: #f1f5f9;">Next: -</div>
    `;

    const refreshLeft = document.createElement('div');
    refreshLeft.style.cssText = `
      padding: 10px 12px; background: rgba(0,0,0,0.3); font-size: 11px;
      color: #cbd5e1; display: flex; flex-direction: column; align-items: center;
    `;
    refreshLeft.innerHTML = `
      <div style="opacity: 0.6; margin-bottom: 2px;">剩余时间</div>
      <div style="font-weight: 600; color: #f1f5f9;">Left: -</div>
    `;

    statusGrid.appendChild(refreshNext);
    statusGrid.appendChild(refreshLeft);

    // ========= Button Row =========
    const refreshBtnRow = document.createElement('div');
    refreshBtnRow.style.cssText = `
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      padding: 0 20px 16px;
    `;

    const refreshShortcut = isMacOS() ? 'F2' : 'Ctrl+Alt+R';
    const refreshBtnToggle = document.createElement('button');
    refreshBtnToggle.textContent = `Pause (${refreshShortcut})`;
    refreshBtnToggle.style.cssText = `
      border: none; cursor: pointer; color: white;
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      padding: 10px 12px; border-radius: 8px; font-weight: 600;
      font-size: 11px; letter-spacing: 0.025em; transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      border: 1px solid rgba(239, 68, 68, 0.2);
    `;
    refreshBtnToggle.addEventListener('mouseenter', () => {
      refreshBtnToggle.style.transform = 'translateY(-2px)';
      refreshBtnToggle.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.4)';
    });
    refreshBtnToggle.addEventListener('mouseleave', () => {
      refreshBtnToggle.style.transform = 'translateY(0)';
      refreshBtnToggle.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
    });

    const refreshBtnNow = document.createElement('button');
    refreshBtnNow.textContent = '立即刷新';
    refreshBtnNow.style.cssText = `
      border: none; cursor: pointer; color: white;
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      padding: 10px 12px; border-radius: 8px; font-weight: 600;
      font-size: 11px; letter-spacing: 0.025em; transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      border: 1px solid rgba(59, 130, 246, 0.2);
    `;
    refreshBtnNow.addEventListener('mouseenter', () => {
      refreshBtnNow.style.transform = 'translateY(-2px)';
      refreshBtnNow.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
    });
    refreshBtnNow.addEventListener('mouseleave', () => {
      refreshBtnNow.style.transform = 'translateY(0)';
      refreshBtnNow.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
    });

    // ========= Footer =========
    const refreshFooter = document.createElement('div');
    refreshFooter.style.cssText = `
      padding: 12px 20px; background: rgba(0,0,0,0.3);
      border-top: 1px solid rgba(255,255,255,0.08);
    `;

    const shortcuts = isMacOS() ? 
      'F1 (Bot) F2 (Refresh) T/F3 (Toggle)' : 
      'Ctrl+Alt+S (Bot) Ctrl+Alt+R (Refresh) T/F3 (Toggle)';
    
    const refreshTip = document.createElement('div');
    refreshTip.style.cssText = `
      font-size: 10px; opacity: 0.7; line-height: 1.4;
      color: #94a3b8; text-align: center;
    `;
    refreshTip.innerHTML = `
      <span style="opacity: 0.5;">⌨️</span> 
      ${shortcuts} | 
      <span style="opacity: 0.5;">⏱️</span> 
      ${REFRESH_CONFIG.MIN_MINUTES}–${REFRESH_CONFIG.MAX_MINUTES}分钟随机间隔
    `;

    refreshBtnRow.appendChild(refreshBtnToggle);
    refreshBtnRow.appendChild(refreshBtnNow);
    refreshBody.appendChild(statusGrid);
    refreshBody.appendChild(refreshBtnRow);
    refreshFooter.appendChild(refreshTip);
    refreshBody.appendChild(refreshFooter);

    // ========= Assemble Main Content =========
    swapSection.appendChild(swapHeader);
    swapSection.appendChild(swapBody);
    refreshSection.appendChild(refreshHeader);
    refreshSection.appendChild(refreshBody);
    
    mainContent.appendChild(swapSection);
    mainContent.appendChild(refreshSection);

    // ========= Assemble Full UI =========
    root.appendChild(header);
    root.appendChild(mainContent);

    document.body.appendChild(root);

    UI.root = root;
    UI.swapStatusDot = swapDot;
    UI.swapStatusText = swapStatus;
    UI.swapBtnToggle = swapBtn;
    UI.swapLogEl = swapLog;
    UI.pairContainer = pairContainer;
    UI.chainCheckboxContainer = chainCheckboxContainer;
    UI.refreshDot = refreshDot;
    UI.refreshStatus = refreshStatus;
    UI.refreshNextEl = refreshNext;
    UI.refreshLeftEl = refreshLeft;
    UI.refreshBtnToggle = refreshBtnToggle;
    UI.refreshBtnNow = refreshBtnNow;
    UI.collapseBtn = collapseBtn;
    UI.mainContent = mainContent;

    UI.setSwapRunning(false);
    UI.renderPairSelection();
    UI.renderChainSelection();
    UI.renderRefresh();

    // 调试：检查UI元素
    console.log('UI Elements created:', {
      root: !!root,
      mainContent: !!mainContent,
      header: !!header,
      collapseBtn: !!collapseBtn,
      swapBtn: !!swapBtn
    });

    // ========= Event Listeners =========
    swapBtn.addEventListener('click', toggleSwap);
    refreshBtnToggle.addEventListener('click', toggleRefresh);
    refreshBtnNow.addEventListener('click', () => doReload('manual'));
    collapseBtn.addEventListener('click', () => {
      console.log('Collapse button clicked');
      UI.togglePanel();
    });

    // 检测操作系统
    const isMac = isMacOS();

    window.addEventListener('keydown', (e) => {
      // 调试信息
      console.log('Key down:', {
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        isMac: isMac
      });
      
      // PC用户：Ctrl + Alt 组合键
      if (!isMac) {
        // Ctrl + Alt + S: Toggle Swap Bot
        if (e.ctrlKey && e.altKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          console.log('Toggle swap bot triggered');
          toggleSwap();
        }
        // Ctrl + Alt + R: Toggle Auto Refresh
        if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault();
          console.log('Toggle refresh triggered');
          toggleRefresh();
        }
      }
        // T: Toggle Panel (仅当焦点不在输入框时)
        if (e.key === 't' || e.key === 'T') {
          const activeElement = document.activeElement;
          const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.contentEditable === 'true'
          );
          
          console.log('T key pressed, inputFocused:', isInputFocused);
          
          if (!isInputFocused) {
            e.preventDefault();
            try {
              console.log('Toggle panel triggered');
              UI.togglePanel();
            } catch (error) {
              console.error('Toggle panel error:', error);
            }
          }
        }

        // Ctrl/Cmd + Shift + R: 保存状态并立即刷新（用于测试）
        if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault();
          UI.logSwap('🔄 手动保存状态并刷新...');
          localStorage.setItem(REFRESH_CONFIG.KEY_SWAP_RUNNING, isSwapRunning ? '1' : '0');
          setTimeout(() => location.reload(), 100);
        }

      // F1-F3 快捷键（所有用户）
      // F1: Toggle Swap Bot
      if (e.key === 'F1') {
        e.preventDefault();
        console.log('F1: Toggle swap bot');
        toggleSwap();
      }
      // F2: Toggle Refresh  
      if (e.key === 'F2') {
        e.preventDefault();
        console.log('F2: Toggle refresh');
        toggleRefresh();
      }
      // F3: Toggle Panel
      if (e.key === 'F3') {
        e.preventDefault();
        console.log('F3: Toggle panel');
        UI.togglePanel();
      }
    });
  }

  // ========= Auto Refresh Functions =========
  function clearRefreshTimers() {
    if (refreshTimerId) clearTimeout(refreshTimerId);
    if (refreshTickerId) clearInterval(refreshTickerId);
    refreshTimerId = null;
    refreshTickerId = null;
  }

  function setNextAt(ts) {
    localStorage.setItem(REFRESH_CONFIG.KEY_NEXT_AT, String(ts));
    UI.renderRefresh(ts);
  }

  function scheduleRefresh() {
    clearRefreshTimers();

    let nextAt = Number(localStorage.getItem(REFRESH_CONFIG.KEY_NEXT_AT) || 0);
    const now = Date.now();

    if (!nextAt || nextAt < now + 2000) {
      nextAt = now + randDelay();
      setNextAt(nextAt);
    }

    refreshTickerId = setInterval(() => {
      UI.renderRefresh(nextAt);
    }, 1000);

    const wait = Math.max(0, nextAt - now);
    refreshTimerId = setTimeout(() => doReload('timer'), wait);
  }

  function doReload(reason) {
    const nextAt = Date.now() + randDelay();
    setNextAt(nextAt);

    // 在刷新前保存swap运行状态
    localStorage.setItem(REFRESH_CONFIG.KEY_SWAP_RUNNING, isSwapRunning ? '1' : '0');
    UI.logSwap(`💾 保存运行状态: ${isSwapRunning ? '运行中' : '已停止'}`);

    sleep(150).then(() => {
      location.reload();
    });
  }

  function setRefreshEnabled(v) {
    refreshEnabled = v;
    localStorage.setItem(REFRESH_CONFIG.KEY_ENABLED, v ? '1' : '0');
    if (refreshEnabled) scheduleRefresh();
    else clearRefreshTimers();
    UI.renderRefresh();
  }

  function toggleRefresh() {
    setRefreshEnabled(!refreshEnabled);
  }

  // ========= Swap Bot Functions =========
  function findCloseBtn() {
    return Array.from(document.querySelectorAll('button'))
      .find(b => b.innerText.trim().toUpperCase() === 'CLOSE' &&
        (b.className || '').includes('bg-genius-pink'));
  }

  function findChooseBtns() {
    return Array.from(document.querySelectorAll('button'))
      .filter(b => b.innerText.trim() === 'Choose' ||
        (b.querySelector('span')?.innerText || '').trim() === 'Choose');
  }

  function findMaxBtn() {
    return Array.from(document.querySelectorAll('button'))
      .find(b => ["MAX", "最大"].includes(b.innerText.trim().toUpperCase()));
  }

  function findConfirmBtn() {
    return Array.from(document.querySelectorAll('button'))
      .find(b => {
        const t = b.innerText.trim().toUpperCase();
        return t.includes("CONFIRM") || t.includes("确认") || t.includes("PLACE");
      });
  }

  function findSimulationFailedBtn() {
    return Array.from(document.querySelectorAll('button'))
      .find(b => {
        const t = b.innerText.trim();
        return t.includes("Simulation failed") && b.disabled;
      });
  }

  function findSwitchBtn() {
    const svg = document.querySelector('svg.lucide-arrow-up-down');
    return svg ? svg.closest('button') : document.querySelector('button[aria-label="Switch"]');
  }

  function isDialogOpen() {
    return !!document.querySelector('[role="dialog"][data-state="open"]');
  }

  async function selectExistingToken() {
    try {
      // 在当前页面上查找已有的代币，优先KOGE，其次USDT
      const allTokens = document.querySelectorAll('[role="dialog"] .cursor-pointer, [role="dialog"] .relative.group');
      
      UI.logSwap(`🔍 在对话框中查找代币，找到 ${allTokens.length} 个元素`);
      
      for (const token of ['KOGE', 'USDT']) {
        for (const row of allTokens) {
          const symbolEl = row.querySelector('.text-xs.text-genius-cream\\/60, .text-sm.text-genius-cream');
          const symbol = symbolEl?.innerText?.trim();
          
          UI.logSwap(`  检查: ${symbol}`);
          
          if (symbol === token) {
            UI.logSwap(`✅ 发现已持有 ${token}，点击选择`);
            row.click();
            await sleep(500);
            return token;
          }
        }
      }
      
      UI.logSwap("⚠️ 未找到已持有的代币");
      return null;
    } catch (error) {
      UI.logSwap(`❌ selectExistingToken 错误: ${error.message}`);
      return null;
    }
  }

  async function selectMaxBalanceToken() {
    try {
      await sleep(SWAP_CONFIG.waitAfterChoose);

      if (!selectedPair) {
        UI.logSwap("❌ 未选择交易对，请先在控制面板选择交易对");
        return false;
      }

      const targetChain = selectedChains[0]; // 获取用户选择的链
      
      let targetToken;
      let shouldSkipSearch = false;
      
      if (selectedPair.name === 'KOGE/USDT') {
        // KOGE/USDT: 自动选择当前已有的代币（优先KOGE，其次USDT）
        UI.logSwap(`🔍 KOGE/USDT 模式：查找已持有的代币`);
        const existingToken = await selectExistingToken();
        if (existingToken) {
          targetToken = existingToken;
          shouldSkipSearch = true;
          selectedFromToken = targetToken;
          return true; // 已点击选择，直接返回
        } else {
          // 没找到已持有的代币
          UI.logSwap("⚠️ 未找到已持有的代币，尝试默认 KOGE");
          targetToken = 'KOGE';
        }
      } else {
        // USDT/USDC: 使用原有的逻辑
        targetToken = selectedPair.from;
      }

      if (!targetToken) {
        UI.logSwap("❌ 未找到目标代币");
        return false;
      }

      UI.logSwap(`目标链: ${targetChain}，开始查找 ${targetToken}`);
      
      // USDT/USDC 逻辑：点击 All 标签，然后选择链
      const tabs = document.querySelectorAll('[role="dialog"] .flex.flex-row.gap-3 > div');
      let allTab = null;
      tabs.forEach(tab => {
        const tabText = tab.innerText.trim().toLowerCase();
        if (tabText.includes('token') || tabText.includes('all')) {
          allTab = tab;
        }
      });

      if (allTab) {
        allTab.click();
        UI.logSwap(`点击 ${allTab.innerText.trim()} 标签`);
        await sleep(SWAP_CONFIG.waitAfterTabClick);
      }

      await sleep(300);

      // 选择链
      tabs.forEach(tab => {
        if (tab.innerText.trim().toLowerCase() === targetChain.toLowerCase()) {
          tab.click();
          UI.logSwap(`点击 ${targetChain} 标签`);
        }
      });
      await sleep(SWAP_CONFIG.waitAfterTabClick);

      // 查找代币
      const tokenRows = document.querySelectorAll('[role="dialog"] .cursor-pointer');
      let maxBalance = -1;
      let targetRow = null;

      for (const row of tokenRows) {
        const symbolEl = row.querySelector('.text-xs.text-genius-cream\\/60');
        const symbol = symbolEl?.innerText?.trim();

        if (symbol === targetToken) {
          const balanceText = row.querySelector('.flex.flex-nowrap.justify-end')?.innerText || '';
          const balanceMatch = balanceText.match(/[\d,\.]+/);
          if (balanceMatch) {
            const balance = parseFloat(balanceMatch[0].replace(/,/g, ''));
            UI.logSwap(`发现 ${symbol}: ${balance}`);
            if (balance > maxBalance) {
              maxBalance = balance;
              targetRow = row;
            }
          }
        }
      }

      if (targetRow) {
        targetRow.click();
        selectedFromToken = targetToken;
        UI.logSwap(`✅ From 选择了 ${targetToken} (余额: ${maxBalance})`);
        return true;
      }

      UI.logSwap(`⚠️ 在 ${targetChain} 链上未找到 ${targetToken}`);
      return false;
      
    } catch (error) {
      UI.logSwap(`❌ selectMaxBalanceToken 错误: ${error.message}`);
      return false;
    }
  }

  async function selectReceiveToken() {
    try {
      await sleep(SWAP_CONFIG.waitAfterChoose);

      if (!selectedPair) {
        UI.logSwap("❌ 未选择交易对，请先在控制面板选择交易对");
        return false;
      }

      const targetToken = selectedPair.to;
      UI.logSwap(`From 是 ${selectedPair.from}，Receive 选择 ${targetToken}`);
      UI.logSwap(`目标链: ${selectedChains[0] || '未选择'}`);

      // 如果是KOGE/USDT，需要特殊处理：点击Saved标签然后搜索
      if (selectedPair.name === 'KOGE/USDT') {
        UI.logSwap('🔍 KOGE/USDT 需要在 Saved 标签中搜索...');
        return await selectKogeFromSaved();
      }

      // USDT/USDC: 使用原有的Stable标签逻辑
      const tabs = document.querySelectorAll('[role="dialog"] .flex.flex-row.gap-3 > div');
      let stableTab = null;
      tabs.forEach(tab => {
        if (tab.innerText.trim().toLowerCase() === 'stable') stableTab = tab;
      });

      if (stableTab) {
        stableTab.click();
        UI.logSwap("点击 Stable 标签");
        await sleep(SWAP_CONFIG.waitAfterTabClick);
      } else {
        UI.logSwap("未找到 Stable 标签，尝试直接选择");
      }

      await sleep(300);

      const tokenRows = document.querySelectorAll('[role="dialog"] .relative.group');
      for (const row of tokenRows) {
        const symbolEl = row.querySelector('.text-sm.text-genius-cream');
        const symbol = symbolEl?.innerText?.trim();

        if (symbol === targetToken) {
          UI.logSwap(`找到 ${symbol}，尝试选择链...`);

          row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          await sleep(SWAP_CONFIG.waitForHover);

          const chainMenu = row.querySelector('.genius-shadow');
          if (chainMenu) {
            const chainOptions = chainMenu.querySelectorAll('.cursor-pointer');
            const targetChain = selectedChains[0];
            if (targetChain) {
              for (const opt of chainOptions) {
                const chainName = opt.querySelector('span')?.innerText?.trim();
                if (CHAIN_CONFIG.CHAIN_ALIASES[targetChain].some(alias => 
                    chainName?.toLowerCase() === alias.toLowerCase())) {
                  opt.click();
                  UI.logSwap(`✅ Receive 选择了 ${symbol} (${targetChain}链)`);
                  return true;
                }
              }
            }
          }

          row.click();
          UI.logSwap(`✅ Receive 直接选择了 ${symbol}`);
          return true;
        }
      }

      UI.logSwap(`⚠️ 未找到 ${targetToken}`);
      return false;

    } catch (error) {
      UI.logSwap(`❌ selectReceiveToken 错误: ${error.message}`);
      return false;
    }
  }

  async function selectKogeFromSaved() {
    try {
      UI.logSwap("🔍 开始搜索 KOGE...");

      // 查找并点击Favorites/Saved标签
      const tabs = document.querySelectorAll('[role="dialog"] .flex.flex-row.gap-3 > div, [role="dialog"] button');
      let favTab = null;
      tabs.forEach(tab => {
        const tabText = tab.innerText.trim().toLowerCase();
        if (tabText.includes('favorite') || tabText.includes('saved') || tabText.includes('收藏')) {
          favTab = tab;
        }
      });

      if (favTab) {
        favTab.click();
        UI.logSwap(`✅ 点击 ${favTab.innerText.trim()} 标签`);
        await sleep(SWAP_CONFIG.waitAfterTabClick);
      }

      await sleep(800);

      // 直接在当前页面查找所有代币行
      const allRows = document.querySelectorAll('[role="dialog"] .cursor-pointer, [role="dialog"] .relative.group, [role="dialog"] button[class*="cursor"]');
      
      // 先搜索KOGE
      let kogeRow = null;
      for (const row of allRows) {
        const symbolEl = row.querySelector('.text-xs.text-genius-cream\\/60, .text-sm.text-genius-cream');
        const symbol = symbolEl?.innerText?.trim();
        
        if (symbol === 'KOGE') {
          kogeRow = row;
          break;
        }
      }

      // 如果没找到，尝试搜索框
      if (!kogeRow) {
        const searchInput = document.querySelector('input[placeholder*="Search" i], input[type="text"]');
        if (searchInput) {
          searchInput.click();
          searchInput.focus();
          searchInput.value = 'KOGE';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          UI.logSwap("🔍 搜索 KOGE...");
          await sleep(1500);
          
          // 再次查找
          const newRows = document.querySelectorAll('[role="dialog"] .cursor-pointer, [role="dialog"] .relative.group');
          for (const row of newRows) {
            const symbolEl = row.querySelector('.text-xs.text-genius-cream\\/60, .text-sm.text-genius-cream');
            const symbol = symbolEl?.innerText?.trim();
            
            if (symbol === 'KOGE') {
              kogeRow = row;
              break;
            }
          }
        }
      }

      if (kogeRow) {
        UI.logSwap(`✅ 找到 KOGE，点击选择`);
        kogeRow.click();
        await sleep(SWAP_CONFIG.waitAfterChoose);
        
        // 等待并检查链选择菜单
        await sleep(500);
        
        // 尝试多种方式找到链选择菜单
        let chainMenu = document.querySelector('.genius-shadow');
        if (!chainMenu) {
          chainMenu = document.querySelector('[class*="chain"]');
        }
        if (!chainMenu) {
          chainMenu = document.querySelector('[role="listbox"]');
        }
        if (!chainMenu) {
          // 检查是否点击后直接选择了（没有链菜单）
          UI.logSwap(`✅ Receive 直接选择了 KOGE`);
          return true;
        }
        
        UI.logSwap(`🔍 找到链菜单，查找 BNB 选项`);
        const chainOptions = chainMenu.querySelectorAll('.cursor-pointer, button, [role="option"]');
        
        for (const opt of chainOptions) {
          const chainName = opt.innerText?.trim() || opt.textContent?.trim();
          UI.logSwap(`  检查链: ${chainName}`);
          
          if (chainName && (chainName.includes('BNB') || chainName.includes('Binance'))) {
            UI.logSwap(`✅ 选择 BNB 链`);
            opt.click();
            await sleep(500);
            return true;
          }
        }
        
        // 如果没找到BNB，选择第一个可用链
        if (chainOptions.length > 0) {
          const firstChain = chainOptions[0].innerText?.trim() || '第一个';
          UI.logSwap(`⚠️ 未找到 BNB，选择 ${firstChain}`);
          chainOptions[0].click();
          await sleep(500);
          return true;
        }
        
        UI.logSwap(`✅ Receive 直接选择了 KOGE`);
        return true;
      }

      UI.logSwap("❌ 未找到 KOGE");
      return false;

    } catch (error) {
      UI.logSwap("❌ 搜索 KOGE 时出错: " + error.message);
      return false;
    }
  }

  async function startSwapLoop() {
    if (window.botRunning) {
      UI.logSwap("⚠️ 脚本已经在运行了！");
      return;
    }
    window.botRunning = true;
    isSwapRunning = true;
    UI.setSwapRunning(true);
    // 运行时保存状态
    localStorage.setItem(REFRESH_CONFIG.KEY_SWAP_RUNNING, '1');

    UI.logSwap(`🚀 Bot started. 区间: ${SWAP_CONFIG.waitRandomMin/1000}s - ${SWAP_CONFIG.waitRandomMax/1000}s`);

    await sleep(SWAP_CONFIG.waitBeforeStart);

    while (isSwapRunning) {
      try {
        UI.logSwap(`--- 新循环 ${new Date().toLocaleTimeString()} ---`);

        const closeBtn = findCloseBtn();
        if (closeBtn) {
          closeBtn.click();
          UI.logSwap("✅ 关闭交易完成弹窗");
          await sleep(SWAP_CONFIG.waitAfterClose);
          continue;
        }

        const chooseBtns = findChooseBtns();
        if (chooseBtns.length > 0) {
          UI.logSwap(`📌 检测到 ${chooseBtns.length} 个 Choose，开始选币 ${selectedPair?.name || ''}...`);

          selectedFromToken = selectedPair?.from || null;

          chooseBtns[0].click();
          UI.logSwap("点击第一个 Choose (From)");
          await sleep(SWAP_CONFIG.waitAfterChoose);

          if (isDialogOpen()) {
            await selectMaxBalanceToken();
            await sleep(SWAP_CONFIG.waitAfterTokenSelect);
          }

          await sleep(500);
          const chooseBtns2 = findChooseBtns();
          if (chooseBtns2.length > 0) {
            chooseBtns2[0].click();
            UI.logSwap("点击第二个 Choose (Receive)");
            await sleep(SWAP_CONFIG.waitAfterChoose);

            if (isDialogOpen()) {
              await selectReceiveToken();
              await sleep(SWAP_CONFIG.waitAfterTokenSelect);
            }
          }

          UI.logSwap("✅ 代币选择完成");
          await sleep(1000);
          continue;
        }

        const btnMax = findMaxBtn();

        if (btnMax && btnMax.disabled) {
          UI.logSwap("⚠️ MAX 灰色，尝试切换方向...");
          const btnSwitch = findSwitchBtn();
          if (btnSwitch) {
            btnSwitch.click();
            await sleep(SWAP_CONFIG.waitAfterFixSwitch);
            continue;
          } else {
            UI.logSwap("❌ 找不到切换按钮");
          }
        }

        if (btnMax && !btnMax.disabled) {
          btnMax.click();
          UI.logSwap("✅ 点击 MAX");
        } else if (!btnMax) {
          UI.logSwap("❌ 没找到 MAX 按钮（可能页面未就绪/按钮文字不同）");
          await sleep(2000);
          continue;
        }

        await sleep(SWAP_CONFIG.waitAfterMax);

        // 首先检查是否有Simulation failed错误
        const simFailedBtn = findSimulationFailedBtn();
        if (simFailedBtn) {
          UI.logSwap("❌ 检测到 Simulation failed，执行页面刷新...");
          await sleep(1000);
          doReload('simulation_failed');
          continue;
        }

        let confirmClicked = false;
        let simFailedDetected = false;
        
        for (let i = 0; i < SWAP_CONFIG.maxRetryConfirm; i++) {
          // 每次重试前检查Simulation failed
          const simFailedCheck = findSimulationFailedBtn();
          if (simFailedCheck) {
            UI.logSwap("❌ Confirm重试期间检测到 Simulation failed，执行刷新...");
            simFailedDetected = true;
            break;
          }
          
          const btnConfirm = findConfirmBtn();
          if (btnConfirm && !btnConfirm.disabled) {
            btnConfirm.click();
            UI.logSwap(`✅ 点击 Confirm (第 ${i + 1} 次)`);
            confirmClicked = true;
            break;
          }
          await sleep(500);
        }

        if (simFailedDetected) {
          await sleep(1000);
          doReload('simulation_failed_retry');
          continue;
        }

        if (confirmClicked) {
          await sleep(SWAP_CONFIG.waitAfterConfirm);

          const closeAfterConfirm = findCloseBtn();
          if (closeAfterConfirm) {
            closeAfterConfirm.click();
            UI.logSwap("✅ 关闭成功弹窗");
            await sleep(SWAP_CONFIG.waitAfterClose);
          }

          const btnSwitch = findSwitchBtn();
          if (btnSwitch) {
            btnSwitch.click();
            UI.logSwap("✅ 切换方向");
          }

          const randomWait = getRandomTime(SWAP_CONFIG.waitRandomMin, SWAP_CONFIG.waitRandomMax);
          UI.logSwap(`🎲 随机休息 ${(randomWait / 1000).toFixed(1)} 秒...`);
          await sleep(randomWait);
        } else {
          UI.logSwap("⚠️ Confirm 未成功，短休后重试...");
          await sleep(2000);
        }
      } catch (e) {
        UI.logSwap("❌ 运行出错（已自动继续）");
        console.error(e);
        await sleep(3000);
      }
    }

    window.botRunning = false;
    UI.setSwapRunning(false);
    // 停止时清除保存的运行状态
    localStorage.setItem(REFRESH_CONFIG.KEY_SWAP_RUNNING, '0');
    UI.logSwap("🛑 Bot stopped.");
  }

  function stopSwapLoop() {
    isSwapRunning = false;
    window.botRunning = false;
    UI.setSwapRunning(false);
    // 停止时清除保存的运行状态
    localStorage.setItem(REFRESH_CONFIG.KEY_SWAP_RUNNING, '0');
    UI.logSwap("🛑 stop() called");
  }

  function toggleSwap() {
    if (isSwapRunning) stopSwapLoop();
    else window.startBot();
  }

  // ========= 暴露全域函數 =========
  window.stopBot = () => stopSwapLoop();
  window.startBot = () => {
    if (isSwapRunning) return;
    loopPromise = startSwapLoop();
  };

  // ========= 初始化 =========
  function init() {
    loadChainConfig(); // 加载链配置
    loadPairConfig(); // 加载交易对配置
    mountUI();
    if (refreshEnabled) scheduleRefresh();
    else UI.renderRefresh();
    
    // 检查并恢复swap运行状态
    const savedSwapRunning = localStorage.getItem(REFRESH_CONFIG.KEY_SWAP_RUNNING) === '1';
    if (savedSwapRunning) {
      UI.logSwap('🔄 检测到刷新前运行中，自动重启...');
      // 延迟一点时间让页面完全加载
      setTimeout(() => {
        window.startBot();
      }, 2000);
    }
    
    const shortcut = isMacOS() ? 'F1' : 'Ctrl+Alt+S';
    UI.logSwap(`Loaded. 交易对: ${selectedPair?.name || '未选择'}, 链: ${selectedChains[0] || '未选择'}. Click Start or press ${shortcut}.`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============================================================
 * Author: 伍壹51 | Hunter Association
 * X (Twitter): https://x.com/0x515151
 *
 * NOTICE:
 * This script is released publicly.
 * Removing or modifying author attribution is NOT permitted.
 * ============================================================ */
