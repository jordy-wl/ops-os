import AIWorkflowStudio from './pages/AIWorkflowStudio';
import BusinessConceptDetail from './pages/BusinessConceptDetail';
import ClientForm from './pages/ClientForm';
import Clients from './pages/Clients';
import FormTemplates from './pages/FormTemplates';
import KnowledgeLibrary from './pages/KnowledgeLibrary';
import MyWork from './pages/MyWork';
import Offerings from './pages/Offerings';
import People from './pages/People';
import ProductDetail from './pages/ProductDetail';
import ServiceDetail from './pages/ServiceDetail';
import Settings from './pages/Settings';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Workflows from './pages/Workflows';
import Library from './pages/Library';
import ClientDetail from './pages/ClientDetail';
import Strategy from './pages/Strategy';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIWorkflowStudio": AIWorkflowStudio,
    "BusinessConceptDetail": BusinessConceptDetail,
    "ClientForm": ClientForm,
    "Clients": Clients,
    "FormTemplates": FormTemplates,
    "KnowledgeLibrary": KnowledgeLibrary,
    "MyWork": MyWork,
    "Offerings": Offerings,
    "People": People,
    "ProductDetail": ProductDetail,
    "ServiceDetail": ServiceDetail,
    "Settings": Settings,
    "WorkflowBuilder": WorkflowBuilder,
    "Workflows": Workflows,
    "Library": Library,
    "ClientDetail": ClientDetail,
    "Strategy": Strategy,
}

export const pagesConfig = {
    mainPage: "MyWork",
    Pages: PAGES,
    Layout: __Layout,
};