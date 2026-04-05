# series domain

Owns series-level governance surfaces:
- series overview
- series settings
- shared subject assets
- series strategy

Migration notes:
- keep existing `/series/[seriesId]` route as shell
- progressively move logic out of `series-detail-client.tsx`
