export interface OneWayWarningRoad {
  id: string;
  label: string;
  direction: string;
  scope: string;
  matchNames: string[];
}

export const ONE_WAY_WARNING_ROADS: OneWayWarningRoad[] = [
  {
    id: 'dinh-tien-hoang',
    label: 'Đinh Tiên Hoàng',
    direction: 'Nguyễn Tri Phương → Trần Phú',
    scope: 'Đoạn thuộc khu trung tâm',
    matchNames: ['Đinh Tiên Hoàng', 'Phố Đinh Tiên Hoàng'],
  },
  {
    id: 'hoang-van-thu',
    label: 'Hoàng Văn Thụ',
    direction: 'Điện Biên Phủ → Cầu Đất',
    scope: 'Theo phân luồng',
    matchNames: ['Hoàng Văn Thụ', 'Phố Hoàng Văn Thụ'],
  },
  {
    id: 'me-linh',
    label: 'Mê Linh',
    direction: 'Nguyễn Đức Cảnh → Tô Hiệu/Hồ Sen',
    scope: 'Đoạn trung tâm',
    matchNames: ['Mê Linh', 'Phố Mê Linh'],
  },
  {
    id: 'cau-dat',
    label: 'Cầu Đất',
    direction: 'Thành Đội → Cầu Đất - Trần Phú',
    scope: 'Đoạn trung tâm',
    matchNames: ['Cầu Đất', 'Phố Cầu Đất'],
  },
  {
    id: 'luong-khanh-thien',
    label: 'Lương Khánh Thiện',
    direction: 'Ngã 6 Máy Tơ → khu vực Rạp Công Nhân',
    scope: 'Theo đoạn được quy định',
    matchNames: [
      'Lương Khánh Thiện',
      'Phố Lương Khánh Thiện',
      'Phố Lương Khánh Thiện (Phố Ga)',
    ],
  },
  {
    id: 'cat-cut',
    label: 'Cát Cụt',
    direction: 'Hai Bà Trưng → Tô Hiệu',
    scope: 'Đoạn trung tâm',
    matchNames: ['Cát Cụt', 'Phố Cát Cụt'],
  },
  {
    id: 'ben-binh',
    label: 'Phố Bến Bính',
    direction: 'Tuyến cần chú ý chiều lưu thông',
    scope: 'Tên OSM gần nhất cho mục Phố Bính',
    matchNames: ['Phố Bến Bính'],
  },
];
