/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Clientes from './pages/Clientes';
import Compras from './pages/Compras';
import Copilot from './pages/Copilot';
import Dashboard from './pages/Dashboard';
import DataManagement from './pages/DataManagement';
import Empleados from './pages/Empleados';
import Inventory from './pages/Inventory';
import Landing from './pages/Landing';
import MyProfile from './pages/MyProfile';
import Onboarding from './pages/Onboarding';
import PanelVentas from './pages/PanelVentas';
import PendingApproval from './pages/PendingApproval';
import Productos from './pages/Productos';
import Recipes from './pages/Recipes';
import Restaurants from './pages/Restaurants';
import Settings from './pages/Settings';
import SII from './pages/SII';
import SuperadminDashboard from './pages/SuperadminDashboard';
import SuperadminProfile from './pages/SuperadminProfile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Clientes": Clientes,
    "Compras": Compras,
    "Copilot": Copilot,
    "Dashboard": Dashboard,
    "DataManagement": DataManagement,
    "Empleados": Empleados,
    "Inventory": Inventory,
    "Landing": Landing,
    "MyProfile": MyProfile,
    "Onboarding": Onboarding,
    "PanelVentas": PanelVentas,
    "PendingApproval": PendingApproval,
    "Productos": Productos,
    "Recipes": Recipes,
    "Restaurants": Restaurants,
    "Settings": Settings,
    "SII": SII,
    "SuperadminDashboard": SuperadminDashboard,
    "SuperadminProfile": SuperadminProfile,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};