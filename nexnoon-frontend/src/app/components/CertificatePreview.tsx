export function CertificatePreview({
  title = "Course title",
  instructor = "Nexnoon Expert",
  information = "The instructor has not provided certificate information yet.",
}: {
  title?: string;
  instructor?: string;
  information?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <div className="p-6 sm:p-7 border-b lg:border-b-0 lg:border-r border-gray-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Certificate</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2 tracking-tight">Earn your certificate</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{information}</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Preview only. Availability and requirements are set by the instructor.
          </p>
        </div>

        <div className="p-6 sm:p-7 bg-gray-50 flex items-center justify-center">
          <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-5 text-center shadow-sm">
            <div className="border-b border-gray-100 pb-3 mb-3">
              <div className="mx-auto mb-2 h-9 w-9 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center justify-center">
                N
              </div>
              <p className="text-sm font-semibold text-gray-900">Nexnoon</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">Certificate of Completion</p>
            </div>
            <p className="text-[11px] text-gray-500">This certifies that</p>
            <p className="text-base font-semibold text-gray-900 mt-1 mb-1">Your Name</p>
            <p className="text-[11px] text-gray-500 mb-1">has completed</p>
            <p className="text-sm font-medium text-gray-800 leading-snug">{title}</p>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-end justify-between text-left">
              <div>
                <div className="w-16 h-px bg-gray-900 mb-1" />
                <p className="text-[11px] text-gray-700">{instructor}</p>
                <p className="text-[10px] text-gray-400">Instructor</p>
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Preview</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
