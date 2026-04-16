/** @odoo-module **/

function initSidebarToggle() {
    const sidebar = document.querySelector('.mk_apps_sidebar_panel');
    if (!sidebar) {
        setTimeout(initSidebarToggle, 500);
        return;
    }
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
        const collapsed = document.body.classList.toggle('sahyog_sidebar_collapsed');
        localStorage.setItem('sahyog_sidebar_collapsed', String(collapsed));
        btn.innerHTML = collapsed
            ? '<i class="fa fa-chevron-right"></i>'
            : '<i class="fa fa-chevron-left"></i>';
        btn.title = collapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
    });

    // Hide the logo to make room
    const logo = sidebar.querySelector('.mk_apps_sidebar_logo');
    if (logo) logo.style.display = 'none';

    const inner = sidebar.querySelector('.mk_apps_sidebar') || sidebar;
    inner.appendChild(btn);
}

// Use simple DOM ready + retry
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initSidebarToggle, 1500));
} else {
    setTimeout(initSidebarToggle, 1500);
}
