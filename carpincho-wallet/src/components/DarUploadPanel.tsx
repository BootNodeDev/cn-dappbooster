import { useState } from 'react'
import { type DarUploadResponse, uploadDarFile } from '@/api/walletService'
import { PrimaryButton } from '@/components/ui/Button'
import { toast } from '@/components/ui/toast'

export interface DarUploadApi {
  uploadDarFile: (file: File) => Promise<DarUploadResponse>
}

interface DarUploadPanelProps {
  api?: DarUploadApi
}

const defaultApi: DarUploadApi = { uploadDarFile }

// Development-only utility for uploading compiled DAML archives through wallet-service.
export const DarUploadPanel = ({ api = defaultApi }: DarUploadPanelProps): JSX.Element => {
  const [file, setFile] = useState<File | undefined>()
  const [uploading, setUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>()

  // Keeps validation and toast feedback inside the dev-only upload utility.
  const onUpload = async (): Promise<void> => {
    if (file === undefined) {
      toast.warning('Select a DAR file')
      return
    }
    setUploading(true)
    setUploadedFileName(undefined)
    try {
      await api.uploadDarFile(file)
      setUploadedFileName(file.name)
      toast.success(`${file.name} uploaded`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 px-1 py-2">
      <label className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground">
        DAR file
        <input
          type="file"
          accept=".dar,application/octet-stream"
          className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-[0.95rem] font-medium normal-case tracking-normal text-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-primary file:font-semibold"
          onChange={(event) => {
            setUploadedFileName(undefined)
            setFile(event.currentTarget.files?.[0])
          }}
        />
      </label>
      <PrimaryButton
        className="w-full"
        disabled={file === undefined || uploading}
        onClick={() => {
          void onUpload()
        }}
      >
        {uploading ? 'Uploading...' : 'Upload DAR'}
      </PrimaryButton>
      {uploadedFileName === undefined ? null : (
        <p
          role="status"
          className="text-center text-[0.9rem] font-semibold text-success"
        >
          {uploadedFileName} uploaded
        </p>
      )}
    </section>
  )
}
