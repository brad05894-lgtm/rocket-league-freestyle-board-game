import BooststoneRuins3D from './BooststoneRuins3D'
import DemoMines3D from './DemoMines3D'
export default function PartyBoard(props){return props.board?.id==='demo-mines'?<DemoMines3D {...props}/>:<BooststoneRuins3D {...props}/>}
