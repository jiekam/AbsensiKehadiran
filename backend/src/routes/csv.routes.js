import express from "express"
import { exportSiswaCSV } from "../controllers/export.controllers.js"

const router = express.Router()

router.get("/csv/siswa-xirpl", exportSiswaCSV)

export default router
