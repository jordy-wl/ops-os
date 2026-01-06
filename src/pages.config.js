import MyWork from './pages/MyWork';
import Workflows from './pages/Workflows';
import Clients from './pages/Clients';
import People from './pages/People';
import Strategy from './pages/Strategy';
import Library from './pages/Library';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "MyWork": MyWork,
    "Workflows": Workflows,
    "Clients": Clients,
    "People": People,
    "Strategy": Strategy,
    "Library": Library,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "MyWork",
    Pages: PAGES,
    Layout: __Layout,
};