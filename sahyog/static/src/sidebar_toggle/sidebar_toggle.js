/** @odoo-module **/

function injectToggle(sidebar) {
    if (sidebar.querySelector('.sahyog-sidebar-collapse-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'sahyog-sidebar-collapse-btn';
    btn.title = 'Collapse Sidebar';
    btn.innerHTML = '<i class="fa fa-chevron-left"></i>';

    const saved = localStorage.getItem('sahyog_sidebar_collapsed');
    if (saved === 'true') {
        document.body.classList.add('sahyog_sidebar_collapsed');
        btn.innerHTML = '<i class="fa fa-chevron-right"></i>';
        btn.title = 'Expand Sidebar';
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = document.body.classList.contains('sahyog_sidebar_collapsed');
        if (isCollapsed) {
            document.body.classList.remove('sahyog_sidebar_collapsed');
            btn.innerHTML = '<i class="fa fa-chevron-left"></i>';
            btn.title = 'Collapse Sidebar';
        } else {
            document.body.classList.add('sahyog_sidebar_collapsed');
            btn.innerHTML = '<i class="fa fa-chevron-right"></i>';
            btn.title = 'Expand Sidebar';
        }
        localStorage.setItem('sahyog_sidebar_collapsed', String(!isCollapsed));
    });

    const inner = sidebar.querySelector('.mk_apps_sidebar') || sidebar;
    inner.appendChild(btn);
}

function init() {
    const sidebar = document.querySelector('.mk_apps_sidebar_panel');
    if (sidebar) {
        injectToggle(sidebar);
        return;
    }
    // Watch for sidebar to appear
    const observer = new MutationObserver(() => {
        const el = document.querySelector('.mk_apps_sidebar_panel');
        if (el) {
            injectToggle(el);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// Wait for DOM to be ready
if (document.body) {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}
