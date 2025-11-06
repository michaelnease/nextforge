// Docker templates
export {
  dockerfileTemplate,
  dockerfileDevTemplate,
  dockerignoreTemplate,
  dockerComposeDevTemplate,
} from "./docker/index.js";

// Page templates
export {
  generatePageTemplate,
  generateLayoutTemplate,
  generateApiRouteTemplate,
  generatePageTestTemplate,
} from "./page/index.js";

// Component templates
export { cssModuleTemplate, storyTemplate } from "./component/index.js";

// Group templates
export { layoutTemplate, readmeTemplate } from "./group/index.js";

// Cursor templates
export { rulesTemplate, phaseTemplate } from "./cursor/index.js";

// Init templates
export { tsTemplate, mjsTemplate, cjsTemplate } from "./init/templates.js";
