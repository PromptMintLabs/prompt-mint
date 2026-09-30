import express from "express";
import {
  AssignPromptReport,
  GetPromptReports,
  SubmitPromptReport,
  UpdatePromptReportNotes,
} from "../controllers/controllers";

export const moderationRouter = express.Router();

moderationRouter.post("/reports", SubmitPromptReport);
moderationRouter.get("/reports", GetPromptReports);
moderationRouter.patch("/reports/:reportId/assignment", AssignPromptReport);
moderationRouter.patch("/reports/:reportId/notes", UpdatePromptReportNotes);