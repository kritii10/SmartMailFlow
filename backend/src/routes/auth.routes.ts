import { Router } from "express";
import {
  getCurrentUserController,
  googleAuthCallbackController,
  logoutController,
  startGoogleAuthController
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.get("/google", startGoogleAuthController);
authRouter.get("/google/callback", googleAuthCallbackController);
authRouter.get("/me", requireAuth, getCurrentUserController);
authRouter.post("/logout", logoutController);
