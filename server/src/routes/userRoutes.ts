import express from "express";
import {
  CreateUser,
  GetUsers,
  GetUserPreferences,
  UpdateUserPreferences,
} from "../controllers/controllers";
import {
  GenerateExportChallenge,
  RequestExport,
  DownloadExport
} from "../controllers/exportController";

export const userRouter = express.Router();

userRouter.route("/").post(CreateUser);
userRouter.route("/").get(GetUsers);

userRouter.route("/preferences").get(GetUserPreferences).put(UpdateUserPreferences);

userRouter.route("/export/challenge").post(GenerateExportChallenge);
userRouter.route("/export").post(RequestExport);
userRouter.route("/export/download/:exportId").get(DownloadExport);
