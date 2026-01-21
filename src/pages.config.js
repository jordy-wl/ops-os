import AIWorkflowStudio from './pages/AIWorkflowStudio';
import BusinessConceptDetail from './pages/BusinessConceptDetail';
import ClientDetail from './pages/ClientDetail';
import ClientForm from './pages/ClientForm';
import Clients from './pages/Clients';
import DealBuilder from './pages/DealBuilder';
import FormTemplates from './pages/FormTemplates';
import KnowledgeLibrary from './pages/KnowledgeLibrary';
import Library from './pages/Library';
import MyWork from './pages/MyWork';
import OfferingDetail from './pages/OfferingDetail';
import Offerings from './pages/Offerings';
import People from './pages/People';
import ProductDetail from './pages/ProductDetail';
import ServiceDetail from './pages/ServiceDetail';
import Settings from './pages/Settings';
import Strategy from './pages/Strategy';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Workflows from './pages/Workflows';
import DealRoom from './pages/DealRoom';
import Glossary from './pages/Glossary';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIWorkflowStudio": AIWorkflowStudio,
    "BusinessConceptDetail": BusinessConceptDetail,
    "ClientDetail": ClientDetail,
    "ClientForm": ClientForm,
    "Clients": Clients,
    "DealBuilder": DealBuilder,
    "FormTemplates": FormTemplates,
    "KnowledgeLibrary": KnowledgeLibrary,
    "Library": Library,
    "MyWork": MyWork,
    "OfferingDetail": OfferingDetail,
    "Offerings": Offerings,
    "People": People,
    "ProductDetail": ProductDetail,
    "ServiceDetail": ServiceDetail,
    "Settings": Settings,
    "Strategy": Strategy,
    "WorkflowBuilder": WorkflowBuilder,
    "Workflows": Workflows,
    "DealRoom": DealRoom,
    "Glossary": Glossary,
}

export const pagesConfig = {
    mainPage: "MyWork",
    Pages: PAGES,
    Layout: __Layout,
};