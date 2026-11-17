'use client'

import * as React from 'react'

import { useDownloads } from '@/hooks/use-downloads'
import { useUI } from '@/hooks/use-ui'

import { Toolbar } from '@/components/toolbar'
import { Sidebar } from '@/components/sidebar'
import { Footer } from '@/components/footer'
import { DownloadsTable } from '@/components/downloads-table'
import { DownloadDetailDrawer } from '@/components/download-detail-drawer'
import { AddDownloadDialog } from '@/components/add-download-dialog'
import { PanelHost } from '@/components/panels/panel-host'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export default function Home() {
  // Initialize the download store + socket once.
  React.useEffect(() => {
    useDownloads.getState().init()
  }, [])

  const panel = useUI((s) => s.panel)
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Toolbar onToggleSidebar={() => setMobileSidebarOpen((v) => !v)} />

      {/* Mobile sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[260px] p-0 sm:max-w-[260px]">
          <SheetHeader className="border-b p-3">
            <SheetTitle className="text-sm">Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Desktop sidebar */}
          <ResizablePanel
            defaultSize={18}
            minSize={14}
            maxSize={26}
            className="hidden md:block"
          >
            <Sidebar />
          </ResizablePanel>
          <ResizableHandle withHandle className="hidden md:flex" />
          <ResizablePanel defaultSize={82} minSize={50}>
            <main className="flex h-full flex-col overflow-hidden">
              {panel !== 'none' && panel !== 'add' ? (
                <PanelHost />
              ) : (
                <DownloadsTable />
              )}
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Footer />
      <DownloadDetailDrawer />
      <AddDownloadDialog />
    </div>
  )
}
