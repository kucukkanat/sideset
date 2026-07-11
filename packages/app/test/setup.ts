import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
// Let React's act() know it is running in a unit-test environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
