import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("liveness", "routes/home/liveness.tsx"),
  route("auth/register", "routes/auth/register.tsx"),
  route("auth/login", "routes/auth/login.tsx"),
  route("me", "routes/me.tsx"),
  route("my_liveness_data", "routes/my_liveness_data.tsx"),
] satisfies RouteConfig;
