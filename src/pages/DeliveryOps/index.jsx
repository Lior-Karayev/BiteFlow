import { OpsScheduler } from './OS'
import DeliveryOpsClient from './DOC'

// DeliveryOps node: Delivery Ops Manager PC
// Components: OpsScheduler (OS) <<assembly>> DeliveryOpsClient (DOC)
// SUC-6: Courier Shift Management | SUC-10: receives courier availability submissions
export default function DeliveryOps() {
  return (
    <OpsScheduler>
      <DeliveryOpsClient />
    </OpsScheduler>
  )
}
