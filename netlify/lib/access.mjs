export const MODULES=['contracts','cfe','water','predial','bank'];
export const PAGES={contracts:'contracts.html',cfe:'cfe.html',water:'water.html',predial:'predial.html',bank:'bank.html'};
export function allowedModules(user,permissions){return user.role==='admin'?MODULES:permissions.filter(m=>MODULES.includes(m));}
export function canAccess(user,modules,module){return Boolean(user?.active&&!user.must_change_password&&MODULES.includes(module)&&(user.role==='admin'||modules.includes(module)));}
export function contentModule(path){
 if(['cfe.html','template-clean.pdf','defaults.json'].includes(path))return 'cfe';
 if(['contracts.html','contracts-catalog.json'].includes(path)||/^templates\/[a-z-]+\.docx$/.test(path))return 'contracts';
 if(['predial.html','predial/template.pdf','predial/defaults.json','predial/fields.js'].includes(path))return 'predial';
 if(['bank.html','bank/template.pdf','bank/defaults.json','bank/fields.js'].includes(path))return 'bank';
 if(['water.html','water/template.pdf','water/defaults.json'].includes(path))return 'water';
 return null;
}
