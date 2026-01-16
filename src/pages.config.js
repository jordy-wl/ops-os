import AIWorkflowStudio from './pages/AIWorkflowStudio';
import BusinessConceptDetail from './pages/BusinessConceptDetail';
import ClientDetail from './pages/ClientDetail';
import ClientForm from './pages/ClientForm';
import Clients from './pages/Clients';
import FormTemplates from './pages/FormTemplates';
import KnowledgeLibrary from './pages/KnowledgeLibrary';
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
import OfferingDetail from './pages/OfferingDetail';
import DealBuilder from './pages/DealBuilder';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIWorkflowStudio": AIWorkflowStudio,
    "BusinessConceptDetail": BusinessConceptDetail,
    "ClientDetail": ClientDetail,
    "ClientForm": ClientForm,
    "Clients": Clients,
    "FormTemplates": FormTemplates,
    "KnowledgeLibrary": KnowledgeLibrary,
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
    "OfferingDetail": OfferingDetail,
    "DealBuilder": DealBuilder,
}

export const pagesConfig = {
    mainPage: "MyWork",
    Pages: PAGES,
    Layout: __Layout,
};