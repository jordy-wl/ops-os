import Clients from './pages/Clients';
import Library from './pages/Library';
import MyWork from './pages/MyWork';
import People from './pages/People';
import Settings from './pages/Settings';
import Strategy from './pages/Strategy';
import Workflows from './pages/Workflows';
import WorkflowBuilder from './pages/WorkflowBuilder';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Clients": Clients,
    "Library": Library,
    "MyWork": MyWork,
    "People": People,
    "Settings": Settings,
    "Strategy": Strategy,
    "Workflows": Workflows,
    "WorkflowBuilder": WorkflowBuilder,
}

export const pagesConfig = {
    mainPage: "MyWork",
    Pages: PAGES,
    Layout: __Layout,
};