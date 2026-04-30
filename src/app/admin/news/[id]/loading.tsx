export default function Loading() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-6" />
      <div className="h-9 w-3/4 bg-gray-200 rounded mb-3" />
      <div className="flex gap-2 mb-2">
        <div className="h-6 w-24 bg-gray-100 rounded-full" />
        <div className="h-6 w-32 bg-gray-100 rounded-full" />
        <div className="h-6 w-20 bg-gray-100 rounded-full" />
      </div>
      <div className="h-4 w-48 bg-gray-100 rounded mt-4 mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-11/12" />
            <div className="h-3 bg-gray-100 rounded w-3/5" />
            <div className="h-4 w-24 bg-gray-200 rounded mt-6" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-4/5" />
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3">
            <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
            <div className="h-12 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3">
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="h-8 w-40 bg-gray-100 rounded-full" />
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
