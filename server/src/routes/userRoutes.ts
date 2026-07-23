import express from "express";
import {
  CreateUser,
  GetUsers,
  GetUserPreferences,
  UpdateUserPreferences,
} from "../controllers/controllers";

export const userRouter = express.Router();

userRouter.route("/").post(CreateUser);
userRouter.route("/").get(GetUsers);

userRouter.route("/preferences").get(GetUserPreferences).put(UpdateUserPreferences);

