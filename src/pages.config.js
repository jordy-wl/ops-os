import BusinessConceptDetail from './pages/BusinessConceptDetail';
import ClientDetail from './pages/ClientDetail';
import Clients from './pages/Clients';
import Library from './pages/Library';
import MyWork from './pages/MyWork';
import Offerings from './pages/Offerings';
import People from './pages/People';
import ProductDetail from './pages/ProductDetail';
import ServiceDetail from './pages/ServiceDetail';
import Settings from './pages/Settings';
import Strategy from './pages/Strategy';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Workflows from './pages/Workflows';
import FormTemplates from './pages/FormTemplates';
import ClientForm from './pages/ClientForm';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BusinessConceptDetail": BusinessConceptDetail,
    "ClientDetail": ClientDetail,
    "Clients": Clients,
    "Library": Library,
    "MyWork": MyWork,
    "Offerings": Offerings,
    "People": People,
    "ProductDetail": ProductDetail,
    "ServiceDetail": ServiceDetail,
    "Settings": Settings,
    "Strategy": Strategy,
    "WorkflowBuilder": WorkflowBuilder,
    "Workflows": Workflows,
    "FormTemplates": FormTemplates,
    "ClientForm": ClientForm,
}

export const pagesConfig = {
    mainPage: "MyWork",
    Pages: PAGES,
    Layout: __Layout,
};