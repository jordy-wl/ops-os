import MyWork from './pages/MyWork';
import Workflows from './pages/Workflows';
import Clients from './pages/Clients';
import __Layout from './Layout.jsx';


export const PAGES = {
    "MyWork": MyWork,
    "Workflows": Workflows,
    "Clients": Clients,
}

export const pagesConfig = {
    mainPage: "MyWork",
    Pages: PAGES,
    Layout: __Layout,
};