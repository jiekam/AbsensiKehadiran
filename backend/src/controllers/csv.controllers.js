import { Parser } from "json2csv"
import supabase from "../config/supabase.js"

export const exportSiswaCSV = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("siswa_xirpl")
      .select("nama, rfid")
      .order("nama", { ascending: true })

    if (error) throw error

    const fields = [
      { label: "Nama", value: "nama" },
      { label: "RFID", value: "rfid" }
    ]

    const parser = new Parser({ fields })
    const csv = parser.parse(data)

    res.setHeader("Content-Type", "text/csv")
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=siswa_xirpl.csv"
    )

    res.send(csv)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal export CSV" })
  }
}
