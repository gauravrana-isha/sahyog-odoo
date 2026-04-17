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
            // Expanding — remove our collapsed class, muk's own class takes over
            document.body.classList.remove('sahyog_sidebar_collapsed');
            btn.innerHTML = '<i class="fa fa-chevron-left"></i>';
            btn.title = 'Collapse Sidebar';
        } else {
            // Collapsing — add our class to override muk's width
            document.body.classList.add('sahyog_sidebar_collapsed');
            btn.innerHTML = '<i class="fa fa-chevron-right"></i>';
            btn.title = 'Expand Sidebar';
        }
        localStorage.setItem('sahyog_sidebar_collapsed', String(!isCollapsed));
    });

    const inner = sidebar.querySelector('.mk_apps_sidebar') || sidebar;
    inner.appendChild(btn);
}

// Watch for the sidebar to appear
const observer = new MutationObserver(() => {
    const sidebar = document.querySelector('.mk_apps_sidebar_panel');
    if (sidebar) {
        injectToggle(sidebar);
        observer.disconnect();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// Check immediately
const existing = document.querySelector('.mk_apps_sidebar_panel');
if (existing) {
    injectToggle(existing);
    observer.disconnect();
}
