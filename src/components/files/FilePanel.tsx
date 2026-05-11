import React from "react";
import { UploadedFile } from "../../types";

interface FilePanelProps {
  files: UploadedFile[];
}

export default function FilePanel({ files }: FilePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-serif font-bold text-[#041632] mb-4">חומרי מחקר</h2>
      <div className="flex-1 space-y-2">
        {files.map((file) => (
          <div key={file.id} className="p-3 border border-[#c5c6ce] rounded-md bg-white hover:bg-[#eff4ff] cursor-pointer transition-colors">
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-[#44474d] mt-1">{file.uploadedAt.toLocaleDateString()}</p>
          </div>
        ))}
      </div>
      <button className="mt-4 w-full py-2 border border-[#75777e] text-[#041632] rounded hover:bg-[#dce9ff] transition-colors text-sm font-medium">
        העלאת מסמך חדש
      </button>
    </div>
  );
}
