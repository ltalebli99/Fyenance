import { openSection } from '../utils/utils.js';
import { getAllCurrencies, setCurrencyPreference } from '../services/currencyService.js';

export class Tutorial {
    constructor() {
        this.steps = [
            {
                element: '.logo',
                message: 'Welcome to Fyenance! Let\'s take a quick tour of the app.',
                position: 'bottom-left',
                type: 'currency-select',
                offset: { x: 20, y: 20 }
            },
            {
                element: '[data-section="Dashboard"]',
                message: 'This is your Dashboard, where you can see an overview of your finances.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Dashboard');
                }
            },
            {
                element: '[data-section="Accounts"]',
                message: 'Manage your bank accounts, credit cards, and other financial accounts here.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Accounts');
                }
            },
            {
                element: '[data-section="Transactions"]',
                message: 'Track your income and expenses by adding transactions.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Transactions');
                }
            },
            {
                element: '#quick-entry-input',
                message: 'Quickly add transactions using the smart entry feature. Try it out!',
                position: 'top-right',
                offset: { x: -20, y: 20 }
            },
            {
                element: '[data-section="Recurring"]',
                message: 'Set up recurring transactions for bills, subscriptions, or regular income.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Recurring');
                }
            },
            {
                element: '[data-section="Categories"]',
                message: 'Organize your transactions with custom categories to better track your spending.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Categories');
                }
            },
            {
                element: '[data-section="Reports"]',
                message: 'View detailed reports and analytics about your spending habits.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Reports');
                }
            },
            { 
                element: '[data-section="Projects"]',
                message: 'Manage projects and track your progress.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Projects');
                }
            },
            {
                element: '[data-section="Settings"]',
                message: 'Customize your experience, manage your data, and configure app preferences here.',
                position: 'bottom',
                action: async (element) => {
                    await openSection({ currentTarget: element }, 'Settings');
                }
            },
            {
                element: '[data-section="smart-import-btn"]',
                message: 'Import your bank statement with the smart import feature. Just upload your CSV bank statement and we\'ll do the rest!',
                position: 'bottom'
            }
        ];
        
        this.currentStep = 0;
        this.overlay = null;
        this.originalParents = new Map(); // Store original parent elements
        this.highlightClone = null;
        this.currentElement = null;
        this.resizeHandler = this.handleResize.bind(this);
    }

    handleResize() {
        if (this.currentElement) {
            this.updateHighlightPosition(this.currentElement);
            this.updateTooltipPosition();
        }
    }

    updateHighlightPosition(element) {
        const wrapper = document.querySelector('.tutorial-highlight-wrapper');
        if (wrapper && element) {
            const rect = element.getBoundingClientRect();
            wrapper.style.left = rect.left + 'px';
            wrapper.style.top = rect.top + 'px';
            wrapper.style.width = rect.width + 'px';
            wrapper.style.height = rect.height + 'px';
        }
    }

    updateTooltipPosition() {
        const tooltip = document.querySelector('.tutorial-tooltip');
        const step = this.steps[this.currentStep];
        if (tooltip && this.currentElement && step) {
            const elementRect = this.currentElement.getBoundingClientRect();
            
            switch (step.position) {
                case 'bottom-left':
                    tooltip.style.left = `${elementRect.left + (step.offset?.x || 0)}px`;
                    tooltip.style.top = `${elementRect.bottom + (step.offset?.y || 0)}px`;
                    break;
                case 'bottom':
                    tooltip.style.left = `${elementRect.left + elementRect.width / 2}px`;
                    tooltip.style.top = `${elementRect.bottom + 20}px`;
                    break;
                case 'top-right':
                    tooltip.style.left = `${elementRect.left}px`;
                    tooltip.style.top = `${elementRect.bottom + (step.offset?.y || 0)}px`;
                    break;
                case 'top':
                    tooltip.style.left = `${elementRect.left + elementRect.width / 2}px`;
                    tooltip.style.top = `${elementRect.top - 20}px`;
                    break;
            }
        }
    }

    async start() {
        const tutorialCompleted = await window.tutorialAPI.getTutorialStatus();
        if (tutorialCompleted) return;

        this.createOverlay();
        this.showStep(0);
    }

    createOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'tutorial-overlay';
            
            // Make the overlay ignore pointer events by default
            this.overlay.style.pointerEvents = 'none';
            
            // Only catch clicks on the actual overlay (not the whole screen)
            const innerOverlay = document.createElement('div');
            innerOverlay.className = 'tutorial-overlay-inner';
            innerOverlay.style.pointerEvents = 'auto';
            this.overlay.appendChild(innerOverlay);
            
            document.body.appendChild(this.overlay);
        }
        this.overlay.style.display = 'block';
    }

    highlightElement(element) {
        this.removeHighlight();
        this.currentElement = element;

        // Create clone and wrapper as before
        this.highlightClone = element.cloneNode(true);
        
        const wrapper = document.createElement('div');
        wrapper.className = 'tutorial-highlight-wrapper';
        
        const rect = element.getBoundingClientRect();
        wrapper.style.position = 'fixed';
        wrapper.style.left = rect.left + 'px';
        wrapper.style.top = rect.top + 'px';
        wrapper.style.width = rect.width + 'px';
        wrapper.style.height = rect.height + 'px';
        wrapper.style.zIndex = '100000';

        this.highlightClone.classList.add('tutorial-highlight');
        this.highlightClone.style.pointerEvents = 'none';
        
        wrapper.appendChild(this.highlightClone);
        document.body.appendChild(wrapper);

        element.style.position = 'relative';
        element.style.zIndex = '100000';

        // Add resize listener
        window.addEventListener('resize', this.resizeHandler);
    }

    removeHighlight() {
        const wrapper = document.querySelector('.tutorial-highlight-wrapper');
        if (wrapper) {
            wrapper.remove();
        }
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.style.position = '';
            el.style.zIndex = '';
        });
        this.currentElement = null;
        this.highlightClone = null;

        // Remove resize listener
        window.removeEventListener('resize', this.resizeHandler);
    }

    nextStep() {
        this.showStep(this.currentStep + 1);
    }

    showStep(index) {
        if (this.isAnimating) return;
        this.currentStep = index;

        if (index >= this.steps.length) {
            this.complete();
            return;
        }

        const step = this.steps[index];
        const element = document.querySelector(step.element);
        
        if (!element) {
            console.warn(`Tutorial element ${step.element} not found, skipping...`);
            this.showStep(index + 1);
            return;
        }

        // Execute the step's action if it exists
        if (step.action) {
            step.action(element);
        }

        // Highlight the element using our new method
        this.highlightElement(element);

        // Animate out the existing tooltip if it exists
        const oldTooltip = document.querySelector('.tutorial-tooltip');
        if (oldTooltip) {
            oldTooltip.classList.add('exit');
            setTimeout(() => oldTooltip.remove(), 300); // Match transition duration
        }

        // Create new tooltip after a brief delay
        setTimeout(() => {
            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = `tutorial-tooltip ${step.position}`;
            tooltip.style.pointerEvents = 'auto';
            tooltip.style.opacity = '0'; // Start invisible
            tooltip.innerHTML = `
                <p>${step.message}</p>
                <div class="tutorial-buttons">
                    <button class="skip-btn">Skip Tutorial</button>
                    <button class="next-btn">${index === this.steps.length - 1 ? 'Finish' : 'Next'}</button>
                </div>
            `;

            // Position tooltip
            const elementRect = element.getBoundingClientRect();
            
            // Special positioning for different positions
            switch (step.position) {
                case 'bottom-left':
                    tooltip.style.left = `${elementRect.left + (step.offset?.x || 0)}px`;
                    tooltip.style.top = `${elementRect.bottom + (step.offset?.y || 0)}px`;
                    tooltip.style.transform = 'scale(0.95)';
                    break;
                case 'bottom':
                    tooltip.style.left = `${elementRect.left + elementRect.width / 2}px`;
                    tooltip.style.top = `${elementRect.bottom + 20}px`;
                    tooltip.style.transform = 'translateX(-50%) scale(0.95)';
                    break;
                case 'top-right':
                    tooltip.style.left = `${elementRect.left}px`;
                    tooltip.style.top = `${elementRect.bottom + (step.offset?.y || 0)}px`;
                    tooltip.style.transform = 'scale(0.95)';
                    break;
                case 'top':
                    tooltip.style.left = `${elementRect.left + elementRect.width / 2}px`;
                    tooltip.style.top = `${elementRect.top - 20}px`;
                    tooltip.style.transform = 'translateX(-50%) translateY(-100%) scale(0.95)';
                    break;
            }

            // Add to DOM
            document.body.appendChild(tooltip);

            // Trigger entrance animation
            requestAnimationFrame(() => {
                tooltip.style.opacity = '1';
                tooltip.style.transform = tooltip.style.transform.replace(' scale(0.95)', '');
            });

            // Add event listeners
            tooltip.querySelector('.next-btn').addEventListener('click', () => {
                this.showStep(index + 1);
            });

            tooltip.querySelector('.skip-btn').addEventListener('click', () => {
                this.complete();
            });

            if (step.type === 'currency-select') {
                const currencies = getAllCurrencies();
                tooltip.innerHTML = `
                    <p>${step.message}</p>
                    <div class="currency-select-container">
                        <select id="currency-preference" class="currency-select">
                            ${currencies.map(c => `
                                <option value="${c.code}">${c.name} (${c.symbol})</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="tutorial-buttons">
                        <button class="next-btn">Continue</button>
                    </div>
                `;

                tooltip.querySelector('#currency-preference').addEventListener('change', (e) => {
                    setCurrencyPreference(e.target.value);
                });

                tooltip.querySelector('.next-btn').addEventListener('click', () => {
                    const selectedCurrency = tooltip.querySelector('#currency-preference').value;
                    setCurrencyPreference(selectedCurrency);
                    this.nextStep();
                });
            }
        }, oldTooltip ? 300 : 0); // Wait for old tooltip to fade if it exists
    }

    async complete() {
        this.removeHighlight(); // This will also remove the resize listener
        // Remove highlight before completing
        this.removeHighlight();
        
        // Animate out the final tooltip
        const tooltip = document.querySelector('.tutorial-tooltip');
        if (tooltip) {
            tooltip.classList.add('exit');
            setTimeout(() => tooltip.remove(), 300);
        }

        this.overlay.style.display = 'none';
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
            el.style.pointerEvents = '';
        });
        await window.tutorialAPI.setTutorialComplete();
    }
}

window.tutorial = new Tutorial();